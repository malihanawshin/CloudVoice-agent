import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Send, Cpu, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types for our chat messages
type Message = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  data?: { instance: string; hours: number; footprint: string }; // Optional data for widgets
};

function App() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('Ready');
  
  // Web Speech API Setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => setStatus('Listening...');
      recognition.onend = () => {
        setIsListening(false);
        setStatus('Ready');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
      };

      recognitionRef.current = recognition;
    } else {
      alert("Browser not supported. Use Chrome.");
    }
  }, []);

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSendMessage = async (text: string) => {
    // Add User Message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setStatus('Thinking...');

    try {
      // Call your Python Bridge
      const response = await axios.post('http://localhost:8000/chat', { prompt: text });
      
      // Parse Response
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: response.data.response,
        // If the backend sent "data", attach it to render the widget
        data: response.data.data 
      };

      setMessages(prev => [...prev, agentMsg]);
      
      // Text-to-Speech (Agent speaks back)
      const utterance = new SpeechSynthesisUtterance(agentMsg.text);
      window.speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', text: "Error connecting to Agent." }]);
    } finally {
      setStatus('Ready');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center p-4">
      {/* Header */}
      <header className="w-full max-w-2xl flex items-center justify-between py-6 border-b border-slate-700 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Cpu size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CloudVoice <span className="text-blue-400">Agent</span></h1>
        </div>
        <div className="text-sm text-slate-400">Tandem Research Prototype</div>
      </header>

      {/* Chat Area */}
      <main className="w-full max-w-2xl flex-1 flex flex-col gap-4 mb-24 overflow-y-auto">
        <AnimatePresence>
          {messages.length === 0 && (
            <div className="text-center text-slate-500 mt-20">
              <p>Try saying: "Check carbon footprint for GPU large"</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user' ? 'bg-blue-600 rounded-br-none' : 'bg-slate-800 rounded-bl-none'
              }`}>
                {msg.text}
              </div>

              {/* Special Widget for Carbon Data */}
              {msg.data && (
                <div className="mt-2 bg-slate-800 border border-green-500/30 p-4 rounded-xl flex items-center gap-4 w-fit">
                  <div className="p-2 bg-green-500/20 rounded-full text-green-400">
                    <Leaf size={24} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold">Sustainability Check</div>
                    <div className="font-mono text-lg">{msg.data.instance}</div>
                    <div className="text-sm text-slate-300">Est. Emissions: High</div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {/* Footer Controls */}
      <div className="fixed bottom-8">
        <div className="flex flex-col items-center gap-2">
          <span className="text-slate-400 text-sm animate-pulse">{status}</span>
          
          <button 
            onClick={toggleMic}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isListening 
                ? 'bg-red-500 shadow-red-500/50 scale-110' 
                : 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/50'
            }`}
          >
            {isListening ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
