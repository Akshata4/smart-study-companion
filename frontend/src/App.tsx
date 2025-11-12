import React, { useState, useEffect, useRef } from 'react';
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
  const [messages, setMessages] = useState<Message[]>([{ id: 0, text: "Hello, how can I help you today?", sender: 'ai' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>({ learnedTopics: [], quizScores: [] });
  const [selectedSubject, setSelectedSubject] = useState('');
  const [learnTopic, setLearnTopic] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [quizData, setQuizData] = useState<any>(null);
  const [learnData, setLearnData] = useState<{ summary: string; example: string; key_terms: string[] } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'learn' | 'quiz' | 'plan'>('learn');
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [syllabusTopics, setSyllabusTopics] = useState<string[]>([]);
  const [syllabusText, setSyllabusText] = useState('');
  const [learningPlan, setLearningPlan] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const defaultTopics: { [key: string]: string[] } = {
    Math: ['Algebra', 'Geometry', 'Calculus'],
    Science: ['Physics', 'Chemistry', 'Biology'],
    History: ['Ancient History', 'Modern History', 'World Wars'],
    Literature: ['Poetry', 'Novels', 'Drama'],
    'Computer Science': ['Programming', 'Algorithms', 'Data Structures']
  };

  useEffect(() => {
    const savedProgress = localStorage.getItem('studyProgress');
    if (savedProgress) {
      setProgress(JSON.parse(savedProgress));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('studyProgress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (syllabusFile) {
      handleExtractTopics();
    } else {
      setSyllabusTopics([]);
      setSyllabusText('');
    }
  }, [syllabusFile]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input, subject: selectedSubject, syllabus_text: syllabusText }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingText(accumulated);
      }

      const aiMessage: Message = {
        id: Date.now() + 1,
        text: accumulated,
        sender: 'ai',
      };
      setMessages(prev => [...prev, aiMessage]);
      setStreamingText('');
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: 'Failed to connect to server.',
        sender: 'ai',
      };
      setMessages(prev => [...prev, errorMessage]);
      setStreamingText('');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleLearn = async () => {
    if (!selectedSubject || !learnTopic.trim()) return;
    setLoading(true);
    try {
      let response;
      if (syllabusFile) {
        const formData = new FormData();
        formData.append('subject', selectedSubject);
        formData.append('topic', learnTopic);
        formData.append('file', syllabusFile);
        response = await fetch('http://localhost:5000/learn', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('http://localhost:5000/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: selectedSubject, topic: learnTopic }),
        });
      }
      const data = await response.json();
      if (response.ok) {
        setQuizData(data);
        setSelectedAnswers(new Array(data.questions.length).fill(''));
        setQuizScore(null);
        setShowConfetti(false);
      } else {
        alert(`Error: ${data.error}`);
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

  const handleGenerateQuizFromFile = async () => {
    if (!uploadedFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', uploadedFile);
    try {
      const response = await fetch('http://localhost:5000/generate-quiz-from-file', {
        method: 'POST',
        body: formData,
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

  const subjectProgress = selectedSubject ? {
    learnedTopics: progress.learnedTopics.filter(topic => topic.startsWith(`${selectedSubject}: `)).map(topic => topic.replace(`${selectedSubject}: `, '')),
    quizScores: progress.quizScores.filter(score => score.topic.startsWith(`${selectedSubject}: `)).map(score => ({ ...score, topic: score.topic.replace(`${selectedSubject}: `, '') }))
  } : { learnedTopics: [], quizScores: [] };

  const totalTopics = 10; // mock
  const learnedCount = subjectProgress.learnedTopics.length;
  const reviewsDue = subjectProgress.quizScores.filter(s => s.score < 80).length;
  const inProgressCount = subjectProgress.quizScores.length - reviewsDue;
  const notStartedCount = totalTopics - learnedCount - inProgressCount;
  const mastery = Math.round((learnedCount / totalTopics) * 100);



  const handleExtractTopics = async () => {
    if (!syllabusFile) return;
    const formData = new FormData();
    formData.append('file', syllabusFile);
    try {
      const response = await fetch('http://localhost:5000/extract-topics', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setSyllabusTopics(data.topics);
        setSyllabusText(data.text);
        // Generate plan
        handleGeneratePlan(data.text);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to extract topics');
    }
  };

  const handleGeneratePlan = async (text: string) => {
    try {
      const response = await fetch('http://localhost:5000/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabus_text: text, subject: selectedSubject })
      });
      const data = await response.json();
      if (response.ok) {
        setLearningPlan(data.plan);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to generate plan');
    }
  };

  const handleQuizSubmit = () => {
    const correctCount = selectedAnswers.filter((ans, i) => ans === quizData.questions[i].correct).length;
    const score = Math.round((correctCount / quizData.questions.length) * 100);
    setQuizScore(score);
    if (score > 80) {
      setShowConfetti(true);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Smart Study Companion</h1>
      </header>

      <div className="main-layout">
        <div className="center-content">
          <section className="top-panel">
            <div className="subject-selector">
              <label>Subject:</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                <option value="">Select Subject</option>
                <option value="Math">Math</option>
                <option value="Science">Science</option>
                <option value="History">History</option>
                <option value="Literature">Literature</option>
                <option value="Computer Science">Computer Science</option>
              </select>
            </div>
            <div className="syllabus-upload">
              <label>Or Upload Syllabus:</label>
              <input type="file" accept=".pdf,.txt" onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)} />
            </div>
          </section>

          <section className="workspace">
            <div className="tabs">
              <button className={activeTab === 'learn' ? 'active' : ''} onClick={() => setActiveTab('learn')}>Learn</button>
              <button className={activeTab === 'quiz' ? 'active' : ''} onClick={() => setActiveTab('quiz')}>Quiz</button>
              <button className={activeTab === 'plan' ? 'active' : ''} onClick={() => setActiveTab('plan')}>Plan</button>
            </div>

            {activeTab === 'learn' && learnData && (
              <div className="learn-content">
                <h3>{learnTopic}</h3>
                <p><strong>Summary:</strong> {learnData.summary}</p>
                <p><strong>Example:</strong> {learnData.example}</p>
                <p><strong>Key Terms:</strong> {learnData.key_terms.join(', ')}</p>
                <button onClick={() => { setProgress(prev => ({ ...prev, learnedTopics: [...prev.learnedTopics, `${selectedSubject}: ${learnTopic}`] })); setLearnData(null); setLearnTopic(''); }}>Mark as read</button>
              </div>
            )}

            {activeTab === 'quiz' && quizData && (
              <div className="quiz-content">
                <h3>Quiz on {quizTopic}</h3>
                {quizData.questions.map((q: any, i: number) => (
                  <div key={i} className="question">
                    <p>{q.question}</p>
                    {q.options.map((opt: string, j: number) => (
                      <label key={j}>
                        <input type="radio" name={`q${i}`} value={opt} onChange={(e) => {
                          const newAnswers = [...selectedAnswers];
                          newAnswers[i] = opt;
                          setSelectedAnswers(newAnswers);
                        }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                ))}
                <button onClick={handleQuizSubmit}>Submit</button>
                {quizScore !== null && <p>Score: {quizScore}%</p>}
                {showConfetti && <p>🎉 Great job!</p>}
              </div>
            )}

            {activeTab === 'plan' && learningPlan && (
              <div className="plan-content">
                <h3>Learning Plan</h3>
                {learningPlan.map((week: any, i: number) => (
                  <div key={i} className="week">
                    <h4>Week {week.week}: {week.topic}</h4>
                    <ul>
                      {week.lessons.map((lesson: string, j: number) => (
                        <li key={j}>{lesson}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <div className="chat-section">
              <h2>AI Chat</h2>
              <div className="chat-container">
                <div className="messages">
                  {messages.slice(-5).map(msg => (
                    <div key={msg.id} className={`message ${msg.sender}`}>
                      <strong>{msg.sender === 'user' ? 'You' : 'AI'}:</strong> {msg.text}
                    </div>
                  ))}
                  {isStreaming && (
                    <div className="message ai streaming">
                      <strong>AI:</strong> {streamingText}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="input-container">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question..."
                    disabled={isStreaming}
                  />
                  <button onClick={sendMessage} disabled={isStreaming}>Send</button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="right-content">
          {activeTab === 'quiz' && !quizData && selectedSubject && (
            <section className="topic-selection">
              <h3>Select Quiz Topic</h3>
              <label>
                Topic:
                <select value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)}>
                  <option value="">Select Topic</option>
                  {(defaultTopics[selectedSubject] || []).concat(syllabusTopics).map(topic => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </label>
              <button onClick={handleQuiz} disabled={isStreaming || !quizTopic}>Take Quiz</button>
            </section>
          )}
          {selectedSubject && (
            <section className="progress-section">
              <div className="main-bar">
                <h2>{selectedSubject} — {mastery}% Mastery ({reviewsDue} reviews due)</h2>
              </div>
              <div className="mini-list">
                <p>Not Started: {notStartedCount}</p>
                <p>In Progress: {inProgressCount}</p>
                <p>Mastered: {learnedCount}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;