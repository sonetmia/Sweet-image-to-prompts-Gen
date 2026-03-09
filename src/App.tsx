/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Settings, 
  CloudUpload, 
  BarChart3, 
  LayoutGrid, 
  RefreshCw, 
  Download, 
  Trash2, 
  Copy, 
  Hourglass,
  CheckCircle2,
  AlertCircle,
  Key,
  Save,
  Share2,
  Globe,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { UploadedFile, ProcessingStatus } from './types';

export default function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'groq'>('gemini');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('sweet_prompt_api_key');
    const savedGroqKey = localStorage.getItem('groq_api_key');
    if (savedGeminiKey) setApiKey(savedGeminiKey);
    if (savedGroqKey) setGroqApiKey(savedGroqKey);
    
    // Set dark mode by default
    document.documentElement.classList.add('dark');
  }, []);

  const saveKeys = () => {
    localStorage.setItem('sweet_prompt_api_key', apiKey);
    localStorage.setItem('groq_api_key', groqApiKey);
    alert('API Keys saved locally!');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => 
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    );

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newFile: UploadedFile = {
          id: Math.random().toString(36).substring(2, 11),
          file,
          base64: e.target?.result as string,
          status: 'ready',
          prompt: ''
        };
        setFiles(prev => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const generatePrompts = async () => {
    const activeGeminiKey = apiKey || process.env.GEMINI_API_KEY;
    const activeGroqKey = groqApiKey;

    if (activeProvider === 'gemini' && !activeGeminiKey) {
      alert('Please provide a Gemini API Key.');
      return;
    }
    if (activeProvider === 'groq' && !activeGroqKey) {
      alert('Please provide a Groq API Key.');
      return;
    }

    const pendingFiles = files.filter(f => f.status === 'ready' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const ai = activeProvider === 'gemini' ? new GoogleGenAI({ apiKey: activeGeminiKey! }) : null;

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileObj = pendingFiles[i];
      setStatusMsg(`Generating detailed prompt for "${fileObj.file.name}"...`);
      
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'processing' } : f));

      try {
        const base64Data = fileObj.base64.split(',')[1];
        let prompt = "";

        if (activeProvider === 'gemini' && ai) {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                parts: [
                  { text: "Analyze this image in extreme detail. Generate a comprehensive, high-fidelity AI image generation prompt for Midjourney v6, Stable Diffusion XL, or DALL-E 3. Include: 1. Subject description (features, clothing, expression). 2. Environment/Background (setting, atmosphere, depth). 3. Lighting (source, intensity, shadows, mood). 4. Color Palette (dominant hues, accents, saturation). 5. Camera & Composition (angle, lens type, framing, depth of field). 6. Artistic Style (medium, texture, level of detail). Return ONLY the prompt text, no headers or commentary." },
                  { inlineData: { mimeType: fileObj.file.type, data: base64Data } }
                ]
              }
            ]
          });
          prompt = response.text || "Failed to generate prompt.";
        } else if (activeProvider === 'groq') {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${activeGroqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: "llama-3.2-11b-vision-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Analyze this image in extreme detail. Generate a comprehensive, high-fidelity AI image generation prompt for Midjourney v6, Stable Diffusion XL, or DALL-E 3. Include: 1. Subject description (features, clothing, expression). 2. Environment/Background (setting, atmosphere, depth). 3. Lighting (source, intensity, shadows, mood). 4. Color Palette (dominant hues, accents, saturation). 5. Camera & Composition (angle, lens type, framing, depth of field). 6. Artistic Style (medium, texture, level of detail). Return ONLY the prompt text, no headers or commentary." },
                    { type: "image_url", image_url: { url: fileObj.base64 } }
                  ]
                }
              ],
              max_tokens: 1000
            })
          });

          if (!response.ok) throw new Error('Groq API request failed');
          const data = await response.json();
          prompt = data.choices[0].message.content.trim();
        }

        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'done', prompt } : f));
      } catch (error: any) {
        console.error(error);
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error', error: error.message } : f));
      }

      const newProgress = Math.round(((i + 1) / pendingFiles.length) * 100);
      setProgress(newProgress);
    }

    setIsProcessing(false);
    setStatusMsg('All images processed.');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const downloadAll = () => {
    const doneFiles = files.filter(f => f.status === 'done');
    if (doneFiles.length === 0) return;

    const content = doneFiles.map(f => f.prompt).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sweet_prompts.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processedCount = files.filter(f => f.status === 'done').length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-primary/20 bg-background-light/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sweet <span className="text-primary">Prompt</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-primary/10 rounded-full transition-colors text-slate-600 dark:text-slate-400">
              <Settings className="w-6 h-6" />
            </button>
            <div className="h-8 w-px bg-primary/20"></div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-400 shadow-inner"></div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto w-full px-6 py-10 space-y-10">
        {/* Hero */}
        <section className="space-y-4 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-slate-900 dark:text-white leading-tight"
          >
            AI Image Prompt Generator
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-xl mx-auto">
              Upload your images and let AI craft high-fidelity prompts for Midjourney, Stable Diffusion, or DALL-E.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-primary">
              <span className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Signoup free</span>
              <span className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Unlimited Prompts generate</span>
              <span className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Published by SONET</span>
            </div>
          </motion.div>
        </section>

        {/* API Key Config */}
        <section className="bg-white dark:bg-white/5 border border-primary/10 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-center gap-4 p-1 bg-slate-100 dark:bg-background-dark/50 rounded-lg w-fit mx-auto border border-primary/10">
            <button 
              onClick={() => setActiveProvider('gemini')}
              className={`px-6 py-2 rounded-md font-bold transition-all ${activeProvider === 'gemini' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-primary'}`}
            >
              Gemini API
            </button>
            <button 
              onClick={() => setActiveProvider('groq')}
              className={`px-6 py-2 rounded-md font-bold transition-all ${activeProvider === 'groq' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-primary'}`}
            >
              Groq API
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Gemini API Key</label>
              <div className="relative group">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/60 group-focus-within:text-primary transition-colors" />
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-background-dark/50 border border-primary/20 rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
                  placeholder="Enter Gemini API key..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Groq API Key</label>
              <div className="relative group">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/60 group-focus-within:text-primary transition-colors" />
                <input 
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-background-dark/50 border border-primary/20 rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
                  placeholder="Enter Groq API key..."
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <button 
              onClick={saveKeys}
              className="bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-12 rounded-lg transition-all shadow-lg shadow-primary/30 flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save All Keys
            </button>
          </div>
        </section>

        {/* Upload Area */}
        <section className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/20'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-primary/20'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('bg-primary/20');
              if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
            }}
            className="border-2 border-dashed border-primary/30 dark:border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-xl p-12 transition-all cursor-pointer group flex flex-col items-center justify-center text-center"
          >
            <div className="mb-4 p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <CloudUpload className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Click or drag & drop images</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Supports JPG, PNG, WEBP • Bulk upload enabled</p>
            <button className="mt-6 px-6 py-2 bg-white dark:bg-white/10 border border-primary/20 rounded-full text-sm font-semibold hover:bg-primary hover:text-white transition-all shadow-sm">
              Select Files
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              multiple 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        </section>

        {/* Status Section */}
        <AnimatePresence>
          {(isProcessing || processedCount > 0) && (
            <motion.section 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white dark:bg-white/5 border border-primary/10 rounded-xl p-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Generation Status
                </h3>
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                  {processedCount} / {files.length} processed
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-white/10 h-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="bg-primary h-full rounded-full shadow-[0_0_12px_rgba(182,19,236,0.6)]"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-2">
                {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {statusMsg || (processedCount === files.length ? 'All images processed.' : 'Waiting to start...')}
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Queue Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-primary/10 pb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-primary" />
              Processing Queue
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={generatePrompts}
                disabled={isProcessing || files.length === 0}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                Generate All
              </button>
              <button 
                onClick={downloadAll}
                disabled={processedCount === 0}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download TXT
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {files.length === 0 ? (
              <div className="text-center py-20 opacity-50">
                <p className="text-lg">No images uploaded yet.</p>
                <p className="text-sm">Upload images to start generating prompts.</p>
              </div>
            ) : (
              files.map((fileObj) => (
                <motion.div 
                  key={fileObj.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-white/5 border border-primary/20 rounded-xl overflow-hidden shadow-lg flex flex-col md:flex-row"
                >
                  <div className="md:w-64 h-48 md:h-auto overflow-hidden relative group">
                    <img 
                      src={fileObj.base64} 
                      alt={fileObj.file.name}
                      className={`w-full h-full object-cover transition-all duration-500 ${fileObj.status === 'processing' ? 'blur-sm scale-110' : ''}`}
                    />
                    {fileObj.status === 'processing' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <RefreshCw className="w-10 h-10 text-white animate-spin" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-background-dark/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => removeFile(fileObj.id)}
                        className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white truncate max-w-[200px] md:max-w-none">
                            {fileObj.file.name}
                          </h4>
                          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">
                            {fileObj.status === 'done' ? 'Generated Prompt' : fileObj.status === 'processing' ? 'Analyzing Image...' : 'Pending...'}
                          </p>
                        </div>
                        <StatusBadge status={fileObj.status} />
                      </div>

                      {fileObj.status === 'done' ? (
                        <div className="space-y-3">
                          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-background-dark/40 p-3 rounded-lg border border-primary/5">
                            {fileObj.prompt}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {/* Mock tags based on prompt content could be extracted here */}
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded">Subject: AI Generated</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded">Style: High Fidelity</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-full animate-pulse"></div>
                          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-[80%] animate-pulse"></div>
                          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-[60%] animate-pulse"></div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      {fileObj.status === 'done' ? (
                        <button 
                          onClick={() => copyToClipboard(fileObj.prompt)}
                          className="flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                        >
                          <Copy className="w-4 h-4" />
                          Copy Prompt
                        </button>
                      ) : (
                        <button 
                          disabled
                          className="flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed"
                        >
                          <Hourglass className="w-4 h-4" />
                          {fileObj.status === 'processing' ? 'Processing...' : 'Please Wait'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-white dark:bg-background-dark/80 py-8 px-6 mt-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-60">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">Sweet Image Prompt</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            Published by <span className="text-primary font-bold">SONET</span>
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-primary transition-colors"><Mail className="w-5 h-5" /></a>
            <a href="#" className="text-slate-400 hover:text-primary transition-colors"><Globe className="w-5 h-5" /></a>
            <a href="#" className="text-slate-400 hover:text-primary transition-colors"><Share2 className="w-5 h-5" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  switch (status) {
    case 'ready':
      return (
        <span className="bg-slate-500/10 text-slate-500 text-[10px] px-2 py-0.5 rounded-full border border-slate-500/20 font-bold uppercase tracking-wider">
          Pending
        </span>
      );
    case 'processing':
      return (
        <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold uppercase tracking-wider">
          Processing
        </span>
      );
    case 'done':
      return (
        <span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20 font-bold uppercase tracking-wider">
          Ready
        </span>
      );
    case 'error':
      return (
        <span className="bg-red-500/10 text-red-500 text-[10px] px-2 py-0.5 rounded-full border border-red-500/20 font-bold uppercase tracking-wider">
          Error
        </span>
      );
    default:
      return null;
  }
}
