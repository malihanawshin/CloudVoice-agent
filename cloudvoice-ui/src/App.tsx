import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Cpu, Leaf, Terminal, Activity, Server, ShieldCheck, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TYPES ---
type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  data?: { instance: string; hours: number; footprint: string };
  requires_approval?: boolean;
  pending_action?: any;
};

type LogEntry = {
  id: string;
  timestamp: string;
  source: 'MCP' | 'LLM' | 'RAG' | 'SYSTEM';
  message: string;
  status: 'info' | 'success' | 'warning';
};

// --- CONFIG ---
// Change this to your Render URL later!
const API_URL = 'http://localhost:8000/chat'; 

function App() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState('System Idle');
  const recognitionRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Helper to add logs
  const addLog = (source: LogEntry['source'], message: string, status: LogEntry['status'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
      source,
      message,
      status
    }]);
  };

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Init Speech API
  useEffect(() => {
    addLog('SYSTEM', 'Initializing CloudVoice Interface...', 'info');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setStatus('Listening...');
        addLog('SYSTEM', 'Microphone active. Capturing audio stream...', 'warning');
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setStatus('Processing...');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        addLog('SYSTEM', `Voice Transcript: "${transcript}"`, 'success');
        handleSendMessage(transcript);
      };

      recognitionRef.current = recognition;
      addLog('SYSTEM', 'Audio Subsystem Ready.', 'success');
    } else {
      addLog('SYSTEM', 'CRITICAL: Browser Speech API not supported.', 'warning');
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

  const handleSendMessage = async (text: string, isApproval = false, pendingData: any = null) => {
    if (!text && !isApproval) return;

    if (!isApproval) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    }

    setStatus('Agent Reasoning...');
    addLog('LLM', isApproval ? 'Sending Approval Token...' : 'Dispatching prompt to GPT-4o...', 'info');

    try {
      const payload = isApproval 
        ? { prompt: `Confirm ${pendingData.instance}`, approved: true }
        : { prompt: text, approved: false };

      const response = await axios.post(API_URL, payload);
      const data = response.data;

      // Log the Agent's "Thought Process" based on response
      if (data.tool_used) {
        addLog('MCP', `Executing Tool: ${data.tool_used}`, 'warning');
        if (data.tool_used === 'consult_manual') addLog('RAG', 'Vector Search: Semantic Match Found', 'success');
        if (data.tool_used === 'calculate_carbon_footprint') addLog('MCP', `Calculation: ${data.data.footprint}`, 'success');
      }
      
      if (data.requires_approval) {
        addLog('SYSTEM', 'Safety Interlock: Human Approval Required', 'warning');
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: data.response,
        data: data.data,
        requires_approval: data.requires_approval,
        pending_action: data.pending_action
      }]);

      const utterance = new SpeechSynthesisUtterance(data.response);
      window.speechSynthesis.speak(utterance);
      addLog('SYSTEM', 'TTS Playback initiated', 'info');

    } catch (error) {
      addLog('SYSTEM', 'Connection Failure: Bridge Unreachable', 'warning');
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: "Error: Backend Bridge is offline." }]);
    } finally {
      setStatus('System Idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans p-4 md:p-8 flex items-center justify-center overflow-hidden">
      
      <div className="w-full max-w-6xl h-[85vh] grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: CHAT INTERFACE */}
        <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl flex flex-col relative overflow-hidden shadow-2xl">
          
          {/* Header */}
          <header className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-3">
              {/* <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
                <Cpu size={20} className="text-blue-400" />
              </div> */}
              <div>
                <h1 className="text-lg font-bold text-white tracking-wide">CloudVoice <span className="text-blue-500">Agent</span></h1>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                  <span className="text-xs text-slate-400 font-mono uppercase">Online • v0.2-Beta</span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-500">
               <div className="flex items-center gap-1"><Server size={12}/> MCP: ACTIVE</div>
               <div className="flex items-center gap-1"><Database size={12}/> RAG: CONNECTED</div>
            </div>
          </header>

          {/* Messages */}
          <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-32">
            <AnimatePresence>
              {messages.length === 0 && (
                 <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4">
                    <Activity size={64} />
                    <p>Awaiting Voice Command...</p>
                 </div>
              )}
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
                >
                  <div className={`px-5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-lg backdrop-blur-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : msg.role === 'system' ? 'bg-red-900/50 border border-red-500/30 text-red-200' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>

                  {/* WIDGETS */}
                  {msg.data && (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="mt-2 ml-1">
                      <div className="bg-slate-900/80 border border-green-500/20 p-4 rounded-xl flex items-center gap-4 min-w-[200px]">
                        <div className="p-2 bg-green-900/30 rounded-full text-green-400"><Leaf size={18} /></div>
                        <div>
                          <div className="text-[10px] text-green-500 font-bold tracking-wider uppercase">Sustainability Report</div>
                          <div className="text-white font-mono font-medium">{msg.data.footprint}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                    {msg.requires_approval && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-3 flex gap-3 ml-1">
                      {/* Approve Button */}
                      <button 
                        onClick={() => handleSendMessage("", true, msg.pending_action)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg"
                      >
                        <ShieldCheck size={14} /> AUTHORIZE DEPLOYMENT
                      </button>

                      {/* Cancel Button */}
                      <button 
                        onClick={() => setMessages(prev => [...prev, {id: Date.now().toString(), role: 'system', text: "Deployment Cancelled by User."}])}
                        className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 text-xs font-bold rounded-lg transition-all"
                      >
                        CANCEL
                      </button>
                    </motion.div>
                  )}

                </motion.div>
              ))}
            </AnimatePresence>
          </main>

          {/* Footer Mic */}
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex justify-center z-10 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-3">
               <div className="h-6 text-xs font-mono text-blue-400 tracking-widest">{status.toUpperCase()}</div>
               <button 
                onClick={toggleMic}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                  isListening ? 'bg-red-500 scale-110 shadow-red-500/40' : 'bg-slate-700 hover:bg-blue-600 border border-slate-600'
                }`}
              >
                {isListening && <span className="absolute inset-0 rounded-full animate-ping bg-red-500/50" />}
                {isListening ? <MicOff size={24} className="text-white relative z-10"/> : <Mic size={24} className="text-slate-300 relative z-10"/>}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: TERMINAL LOGS */}
        <div className="hidden lg:flex flex-col bg-black/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
            <Terminal size={14} className="text-slate-500"/>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">System Kernel Logs</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
            {logs.map(log => (
              <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                <div className="flex-1 break-words">
                  <span className={`font-bold mr-2 ${
                    log.source === 'MCP' ? 'text-purple-400' : 
                    log.source === 'LLM' ? 'text-blue-400' :
                    log.source === 'RAG' ? 'text-yellow-400' : 'text-slate-500'
                  }`}>{log.source}:</span>
                  <span className={`${
                    log.status === 'success' ? 'text-green-400' : 
                    log.status === 'warning' ? 'text-orange-400' : 'text-slate-300'
                  }`}>{log.message}</span>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
