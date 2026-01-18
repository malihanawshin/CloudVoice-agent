import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Send, Cpu, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  data?: { instance: string; hours: number; footprint: string };
  requires_approval?: boolean; // New flag
  pending_action?: any;        // Store data to retry later
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

    // Add a new argument 'isApproval' to re-send a pending request
  const handleSendMessage = async (text: string, isApproval = false, pendingData: any = null) => {
    
    // Only add user message if it's NOT a silent button click
    if (!isApproval) {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
      setMessages(prev => [...prev, userMsg]);
    }

    setStatus('Thinking...');

    try {
      // Send request. If approving, send 'approved: true' and the original prompt
      const payload = isApproval 
        ? { prompt: `Confirm ${pendingData.instance}`, approved: true }
        : { prompt: text, approved: false };

      const response = await axios.post('http://localhost:8000/chat', payload);
      
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: response.data.response,
        data: response.data.data,
        requires_approval: response.data.requires_approval, // Catch the flag
        pending_action: response.data.pending_action        // Catch the pending data
      };

      setMessages(prev => [...prev, agentMsg]);
      
      const utterance = new SpeechSynthesisUtterance(agentMsg.text);
      window.speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error(error);
    } finally {
      setStatus('Ready');
    }
  };


  return (
    // OUTER CONTAINER: Centers the "Phone/App" window on screen
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }} className="bg-slate-900 text-white font-sans p-4">
      
      {/* INNER APP CONTAINER: The "Phone Screen" itself */}
      <div className="w-full max-w-2xl h-[85vh] bg-slate-950/50 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col">
        
        {/* Header - Stays at top of container */}
        <header className="flex-none px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Cpu size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">Cloud Voice</h1>
              <span className="text-xs text-blue-400 font-medium">Research Prototype</span>
            </div>
          </div>
          <div className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 font-mono">
             v0.1-alpha
          </div>
        </header>

        {/* Chat Area - Grows to fill space */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-32 scroll-smooth">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                <Leaf size={48} className="text-slate-600" />
                <p className="text-sm">Try saying: "Check carbon footprint for GPU large"</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}
              >
                {/* Message Bubble */}
                <div className={`max-w-[85%] px-5 py-3 text-sm leading-relaxed shadow-md ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                    : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm border border-slate-700'
                }`}>
                  {msg.text}
                </div>

                {/* Widget */}
                {msg.data && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 ml-2 bg-slate-900 border border-green-500/30 p-4 rounded-xl flex items-center gap-4 w-fit shadow-lg shadow-green-900/10"
                  >
                    <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center text-green-400">
                      <Leaf size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-green-500 uppercase font-bold tracking-wider mb-0.5">Sustainability Report</div>
                      <div className="font-mono text-base text-white">{msg.data.instance.toUpperCase()}</div>
                      <div className="text-xs text-slate-400">Est. Emissions: <span className="text-white font-medium">{msg.data.footprint}</span></div>
                    </div>
                  </motion.div>
                )}

              {/* Human-in-the-Loop Approval Widget */}
              {msg.requires_approval && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 ml-2 flex gap-3"
                >
                  <button 
                    onClick={() => handleSendMessage("", true, msg.pending_action)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => setMessages(prev => [...prev, {id: Date.now().toString(), role: 'agent', text: "Action cancelled."}])}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-all"
                  >
                    Reject
                  </button>
                </motion.div>
              )}


              </motion.div>
            ))}
          </AnimatePresence>
        </main>

        {/* Footer Controls - Absolute position within the relative container */}
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent flex flex-col items-center justify-end z-20 h-32 pointer-events-none">
          {/* Pointer events auto allows clicking the button but clicking through the gradient */}
          <div className="pointer-events-auto flex flex-col items-center gap-3">
            <span className={`text-xs font-medium tracking-wide transition-colors ${
               status === 'Listening...' ? 'text-red-400 animate-pulse' : 'text-slate-500'
            }`}>
              {status}
            </span>
            
            <button 
              onClick={toggleMic}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl border-4 ${
                isListening 
                  ? 'bg-red-500 border-red-900/50 shadow-red-500/20 scale-110' 
                  : 'bg-blue-600 border-slate-900 hover:bg-blue-500 hover:scale-105 shadow-blue-500/20'
              }`}
            >
              {isListening ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

}

export default App;
