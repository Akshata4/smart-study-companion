from flask import Flask, request, jsonify, redirect, url_for, Response
from openai import OpenAI
import os
import json
from dotenv import load_dotenv
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from docx import Document
import io
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth

load_dotenv(override=True)

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///study.db'
db = SQLAlchemy(app)

oauth = OAuth(app)
oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid_configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name required'}), 400
    user = User.query.filter_by(name=name).first()
    if not user:
        user = User(name=name)
        db.session.add(user)
        db.session.commit()
    return jsonify({'user_id': user.id, 'name': user.name})

@app.route('/login/google')
def login_google():
    redirect_uri = url_for('auth_google', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/auth/google')
def auth_google():
    token = oauth.google.authorize_access_token()
    user_info = oauth.google.parse_id_token(token)
    name = user_info['name']
    user = User.query.filter_by(name=name).first()
    if not user:
        user = User(name=name)
        db.session.add(user)
        db.session.commit()
    return redirect(f'http://localhost:3000?user_id={user.id}&name={user.name}')

@app.route('/learn', methods=['POST'])
def learn():
    subject = request.form.get('subject') or request.get_json().get('subject', '')
    topic = request.form.get('topic') or request.get_json().get('topic', '')
    
    if not subject or not topic:
        return jsonify({'error': 'Subject and topic required'}), 400
    
    syllabus_text = ''
    if 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            try:
                syllabus_text = extract_text(file)
            except Exception as e:
                return jsonify({'error': f'Error processing file: {str(e)}'}), 400
    
    try:
        prompt = 'Generate 10 multiple-choice questions on the topic "' + topic + '". For each question, provide: the question text, 4 options labeled A), B), C), D), the correct answer letter (e.g., "A"), and a brief explanation for why it is correct. Return as a JSON object with a key "questions" that is an array of objects, each containing "question" (string), "options" (array of 4 strings), "correct" (string), "explanation" (string).'
        if syllabus_text:
            prompt += ' Base the questions on this syllabus: ' + syllabus_text[:1000]
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a quiz generator. Generate questions based on the topic and syllabus."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if content:
            data = json.loads(content)
            return jsonify(data)
        else:
            return jsonify({'error': 'No content generated'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def extract_text(file):
    filename = secure_filename(file.filename)
    if filename.endswith('.pdf'):
        pdf = PdfReader(io.BytesIO(file.read()))
        text = ""
        for page in pdf.pages:
            text += page.extract_text()
        return text
    elif filename.endswith('.txt'):
        return file.read().decode('utf-8')
    elif filename.endswith('.docx'):
        doc = Document(io.BytesIO(file.read()))
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    else:
        raise ValueError("Unsupported file type")

@app.route('/quiz', methods=['POST'])
def quiz():
    data = request.get_json()
    topic = data.get('topic', '')
    
    if not topic:
        return jsonify({'error': 'No topic provided'}), 400
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Generate 3 multiple-choice questions on the given topic. Each question should have 4 options (A, B, C, D) and indicate the correct answer. Return in JSON format: {\"questions\": [{\"question\": \"...\", \"options\": [\"A) ...\", \"B) ...\", \"C) ...\", \"D) ...\"], \"correct\": \"A\"}]} "},
                {"role": "user", "content": f"Topic: {topic}"}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if content:
            quiz_data = json.loads(content)
            return jsonify(quiz_data)
        else:
            return jsonify({'error': 'No content generated'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message = data.get('message', '')
    subject = data.get('subject', '')
    syllabus_text = data.get('syllabus_text', '')
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    try:
        system_message = f"You are a helpful assistant. Answer questions in the context of {subject}. Format your response with bullet points, new lines, and clear structure for readability." if subject else "You are a helpful assistant. Format your response with bullet points, new lines, and clear structure for readability."
        if syllabus_text:
            system_message += f" Use this syllabus information: {syllabus_text[:1000]}"
        def stream_chat():
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": message}
                ],
                stream=True
            )
            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        return Response(stream_chat(), mimetype='text/plain')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/extract-topics', methods=['POST'])
def extract_topics():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    try:
        text = extract_text(file)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Extract 3-5 key topics from the provided syllabus text. Return as JSON: {\"topics\": [\"topic1\", \"topic2\", ...]}"},
                {"role": "user", "content": f"Syllabus: {text[:2000]}"}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if content:
            data = json.loads(content)
            data['text'] = text
            return jsonify(data)
        else:
            return jsonify({'error': 'No content generated'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    data = request.get_json()
    syllabus_text = data.get('syllabus_text', '')
    subject = data.get('subject', '')
    if not syllabus_text:
        return jsonify({'error': 'No syllabus text provided'}), 400
    try:
        prompt = "Create a structured learning plan for the subject " + subject + " based on the syllabus. Return as JSON: {\"plan\": [{\"week\": 1, \"topic\": \"...\", \"lessons\": [\"lesson1\", \"lesson2\"] }, ...]}"
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a learning plan generator."},
                {"role": "user", "content": prompt + " Syllabus: " + syllabus_text[:2000]}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if content:
            plan_data = json.loads(content)
            return jsonify(plan_data)
        else:
            return jsonify({'error': 'No content generated'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-quiz-from-file', methods=['POST'])
def generate_quiz_from_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    try:
        text = extract_text(file)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Generate 3 multiple-choice questions based on the provided text. Each question should have 4 options (A, B, C, D) and indicate the correct answer. Return in JSON format: {\"questions\": [{\"question\": \"...\", \"options\": [\"A) ...\", \"B) ...\", \"C) ...\", \"D) ...\"], \"correct\": \"A\"}]} "},
                {"role": "user", "content": f"Text: {text[:4000]}"}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if content:
            quiz_data = json.loads(content)
            return jsonify(quiz_data)
        else:
            return jsonify({'error': 'No content generated'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500





with app.app_context():
    db.create_all()
    # Seed users
    if not User.query.filter_by(name='Akshata').first():
        db.session.add(User(name='Akshata'))
    if not User.query.filter_by(name='Ankur').first():
        db.session.add(User(name='Ankur'))
    db.session.commit()

if __name__ == '__main__':
    app.run(debug=True)