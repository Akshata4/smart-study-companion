import React, { useState, useEffect } from 'react';
import './App.css';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

interface Progress {
  learnedTopics: string[];
  quizScores: { topic: string; score: number }[];
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>({ learnedTopics: [], quizScores: [] });
  const [learnTopic, setLearnTopic] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [quizData, setQuizData] = useState<any>(null);
  const [summary, setSummary] = useState<string>('');

  useEffect(() => {
    const savedProgress = localStorage.getItem('studyProgress');
    if (savedProgress) {
      setProgress(JSON.parse(savedProgress));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('studyProgress', JSON.stringify(progress));
  }, [progress]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      if (response.ok) {
        const aiMessage: Message = {
          id: Date.now() + 1,
          text: data.response,
          sender: 'ai',
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const errorMessage: Message = {
          id: Date.now() + 1,
          text: `Error: ${data.error}`,
          sender: 'ai',
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: 'Failed to connect to server.',
        sender: 'ai',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleLearn = async () => {
    if (!learnTopic.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: learnTopic }),
      });
      const data = await response.json();
      if (response.ok) {
        setProgress(prev => ({ ...prev, learnedTopics: [...prev.learnedTopics, learnTopic] }));
        setSummary(data.summary);
      } else {
        setSummary(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuiz = async () => {
    if (!quizTopic.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: quizTopic }),
      });
      const data = await response.json();
      if (response.ok) {
        setQuizData(data);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Smart Study Companion</h1>
      <div className="progress">
        <h2>Progress</h2>
        <p>Learned Topics: {progress.learnedTopics.join(', ') || 'None'}</p>
        <p>Quiz Scores: {progress.quizScores.map(s => `${s.topic}: ${s.score}`).join(', ') || 'None'}</p>
      </div>
      <div className="tools">
        <div className="tool">
          <input
            type="text"
            value={learnTopic}
            onChange={(e) => setLearnTopic(e.target.value)}
            placeholder="Enter topic to learn"
          />
          <button onClick={handleLearn} disabled={loading}>Learn</button>
        </div>
        <div className="tool">
          <input
            type="text"
            value={quizTopic}
            onChange={(e) => setQuizTopic(e.target.value)}
            placeholder="Enter topic for quiz"
          />
          <button onClick={handleQuiz} disabled={loading}>Take Quiz</button>
        </div>
      </div>
      {quizData && (
        <div className="quiz">
          <h3>Quiz on {quizTopic}</h3>
          {quizData.questions.map((q: any, i: number) => (
            <div key={i}>
              <p>{q.question}</p>
              <ul>
                {q.options.map((opt: string, j: number) => (
                  <li key={j}>{opt}</li>
                ))}
              </ul>
              <p><strong>Correct: {q.correct}</strong></p>
            </div>
          ))}
          <button onClick={() => setQuizData(null)}>Clear Quiz</button>
        </div>
      )}
      {summary && (
        <div className="summary">
          <h3>Summary</h3>
          <p>{summary}</p>
          <button onClick={() => setSummary('')}>Clear Summary</button>
        </div>
      )}
      <div className="chat-container">
        <div className="messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <strong>{msg.sender === 'user' ? 'You' : 'AI'}:</strong> {msg.text}
            </div>
          ))}
          {loading && <div className="message ai">AI is typing...</div>}
        </div>
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={loading}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;