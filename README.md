# smart-study-companion
Smart Study Companion is an AI-powered learning assistant that makes studying more personal, fun, and human. It adapts to each student’s pace, tone, and skill level turning study sessions into friendly, interactive conversations.

## Setup

1. Install uv (if not already installed):
   ```
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Initialize the project:
   ```
   uv init
   ```

3. Add dependencies:
   ```
   uv add flask openai
   ```

4. Activate the virtual environment (created automatically):
   ```
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

5. Set your OpenAI API key in `.env`:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

6. Run the backend:
   ```
   python app.py
   ```

7. In a new terminal, run the frontend:
   ```
   cd frontend && npm run dev
   ```

The backend runs on http://localhost:5000, frontend on http://localhost:5173

## API

- `GET /`: Welcome message
- `POST /chat`: Send a message to the study companion
  - Body: `{"message": "Your study question here"}`
  - Response: `{"response": "AI's reply"}`
- `POST /learn`: Get a short summary of a topic
  - Body: `{"topic": "Topic to summarize"}`
  - Response: `{"summary": "Short summary of the topic"}`
- `POST /quiz`: Generate 3 multiple-choice questions on a topic
  - Body: `{"topic": "Topic for quiz"}`
  - Response: `{"questions": [{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A"}]}`
