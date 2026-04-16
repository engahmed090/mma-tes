import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadedShape } from '@/hooks/useShapeData';
import AIWorkingPanel, { useAIStages, AIWorkingInput } from './AIWorkingPanel';
import { Bot, Send, Trash2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChatTabProps {
  shapes: LoadedShape[];
  thrDb: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS_CST = [
  "What is the best absorber in my data at 10 GHz?",
  "Which shape gives highest absorption across all frequencies?",
  "How to set up unit cell boundaries in CST for absorber?",
];

const SUGGESTIONS_REF = [
  "Design a metamaterial absorber for 10 GHz with full dimensions",
  "Best X-band absorber from literature with dimensions",
  "Design Ka-band metamaterial absorber 30 GHz",
];

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const ChatTab: React.FC<ChatTabProps> = ({ shapes, thrDb }) => {
  const [brain, setBrain] = useState<'cst' | 'ref'>('cst');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const messagesEnd = useRef<HTMLDivElement>(null);

  const { stage, setStage, elapsed, startTimer, stopTimer, reset } = useAIStages();
  const [aiInputs, setAiInputs] = useState<AIWorkingInput[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AIWorkingInput[]>([]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildKnowledge = () => {
    const lines: string[] = ['AHMED\'S ABSORBER SHAPES — REAL CST DATA\n'];
    for (const s of shapes) {
      if (!s.isReal) continue;
      lines.push(`SHAPE: ${s.displayName}`);
      lines.push(`  Freq: ${s.ranges.fmin.toFixed(2)}–${s.ranges.fmax.toFixed(2)} GHz`);
      let bestEntry: { s11: number; p: number; f: number; abs: number } | null = null;
      for (const pk of Object.keys(s.curves)) {
        const p = parseFloat(pk);
        const { freqs, s11 } = s.curves[p];
        const minS11 = Math.min(...s11);
        const ib = s11.indexOf(minS11);
        const absPct = Math.max(0, Math.min(1, 1 - Math.pow(10, minS11 / 10))) * 100;
        if (!bestEntry || minS11 < bestEntry.s11) {
          bestEntry = { s11: minS11, p, f: freqs[ib], abs: absPct };
        }
      }
      if (bestEntry) {
        lines.push(`  ★ BEST: P=${bestEntry.p.toFixed(3)}mm → S11=${bestEntry.s11.toFixed(2)}dB @ ${bestEntry.f.toFixed(2)}GHz | Absorption=${bestEntry.abs.toFixed(1)}%`);
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setProvider('');

    // Start AI visualization
    reset();
    startTimer();
    setAiInputs([
      { label: 'Brain', value: brain === 'cst' ? 'CST Data' : 'Reference' },
      { label: 'Query', value: text.slice(0, 40) },
      { label: 'Shapes', value: `${shapes.filter(s => s.isReal).length} loaded` },
    ]);
    setAiOutputs([]);
    setStage('input');

    try {
      await new Promise(r => setTimeout(r, 300));
      setStage('preprocessing');

      await new Promise(r => setTimeout(r, 300));
      setStage('network');

      const resp = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          brain,
          knowledge: brain === 'cst' ? buildKnowledge() : undefined,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
        throw new Error(errData.error || `API error (${resp.status})`);
      }

      // Read which provider answered
      const usedProvider = resp.headers.get('X-AI-Provider') || 'unknown';
      setProvider(usedProvider);

      if (!resp.body) throw new Error('No response body');

      setStage('output');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantSoFar = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (!assistantSoFar) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'No response received. Please try again.' }]);
      }

      // Set real outputs
      const modelLabel = usedProvider === 'openrouter' ? 'DeepSeek-R1' : 'LLaMA-3.3-70B';
      setAiOutputs([
        { label: 'Response', value: `${assistantSoFar.length} chars` },
        { label: 'Model', value: modelLabel },
        { label: 'Brain', value: brain === 'cst' ? 'CST Data' : 'Reference' },
      ]);
      setStage('complete');
      stopTimer();
    } catch (e: any) {
      console.error('Chat error:', e);
      toast.error(e.message || 'Failed to get AI response');
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${e.message}` }]);
      setAiOutputs([{ label: 'Status', value: 'Error' }]);
      setStage('complete');
      stopTimer();
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      rendered = rendered.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-primary underline">$1</a>');
      rendered = rendered.replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>');
      return <div key={i} dangerouslySetInnerHTML={{ __html: rendered || '&nbsp;' }} />;
    });
  };

  return (
    <div className="space-y-4 tab-content-enter">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" /> AI Expert Chat
        {provider && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">
            via {provider === 'openrouter' ? 'DeepSeek-R1' : 'LLaMA-3.3-70B'}
          </span>
        )}
      </h2>

      <div className="flex gap-2">
        <Button variant={brain === 'cst' ? 'default' : 'outline'} size="sm" onClick={() => setBrain('cst')}>
          📊 CST Data Brain
        </Button>
        <Button variant={brain === 'ref' ? 'default' : 'outline'} size="sm" onClick={() => setBrain('ref')}>
          📚 Reference Brain
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setMessages([])}>
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `${brain}_chat.txt`; a.click();
        }}>
          <Download className="w-3 h-3 mr-1" /> Export
        </Button>
      </div>

      <div>
        <div className="text-sm text-muted-foreground mb-2">💡 Quick Questions:</div>
        <div className="flex flex-wrap gap-2">
          {(brain === 'cst' ? SUGGESTIONS_CST : SUGGESTIONS_REF).map((s, i) => (
            <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => handleSend(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* AI Working Panel */}
      <AIWorkingPanel
        stage={stage}
        inputs={aiInputs}
        outputs={aiOutputs}
        elapsed={elapsed}
        title="AI Expert — Neural Processing"
      />

      <div className="rounded-lg border border-border bg-secondary/20 h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Ask about absorbers, frequencies, references, design...
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
              m.role === 'user' ? 'bg-primary text-primary-foreground whitespace-pre-wrap' : 'bg-card text-foreground border border-border'
            }`}>
              {m.role === 'assistant' ? renderContent(m.content) : m.content}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {brain === 'ref' ? 'Searching & thinking...' : 'Thinking...'}
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(input)}
          placeholder="Ask about absorbers, frequencies, references, design..."
          className="flex-1 font-mono"
        />
        <Button onClick={() => handleSend(input)} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatTab;
