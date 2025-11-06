from flask import Flask, request, jsonify
from openai import OpenAI
import os
import json
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv(override=True)

app = Flask(__name__)
CORS(app)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

@app.route('/')
def home():
    return "Welcome to Smart Study Companion!"

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful study companion. Guide, quiz, and encourage the user in their learning."},
                {"role": "user", "content": user_message}
            ]
        )
        ai_message = response.choices[0].message.content
        return jsonify({'response': ai_message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/learn', methods=['POST'])
def learn():
    data = request.get_json()
    topic = data.get('topic', '')
    
    if not topic:
        return jsonify({'error': 'No topic provided'}), 400
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Provide a short, concise summary of the given topic for learning purposes."},
                {"role": "user", "content": f"Summarize: {topic}"}
            ]
        )
        summary = response.choices[0].message.content
        return jsonify({'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

if __name__ == '__main__':
    app.run(debug=True)