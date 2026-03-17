import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface RangeSelection {
  startDate: string;
  endDate: string;
}

interface Props {
  symbol: string;
  selectedRange?: RangeSelection | null;
}

interface CopilotResponse {
  symbol: string;
  start_date: string;
  end_date: string;
  price_change_pct: number;
  news_count: number;
  answer: string;
  key_points: string[];
  risk_points: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
  keyPoints?: string[];
  riskPoints?: string[];
}

const DEFAULT_QUESTIONS = [
  '这只股票最近的主要驱动因素是什么？',
  '如果只看走势结构，现在最值得注意的信号是什么？',
  '结合最近波动，风险点主要在哪里？',
];

const RANGE_QUESTIONS = [
  '这段行情为什么会这样走？',
  '这段区间里最重要的驱动因素是什么？',
  '如果我只看这一段，最大的风险和机会分别是什么？',
];

export default function AICopilotPanel({ symbol, selectedRange }: Props) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const presets = useMemo(
    () => (selectedRange ? RANGE_QUESTIONS : DEFAULT_QUESTIONS),
    [selectedRange]
  );

  useEffect(() => {
    setQuestion('');
    setError('');
    setChat([]);
  }, [symbol, selectedRange?.startDate, selectedRange?.endDate]);

  async function ask(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || !symbol) return;

    const history = chat.map((item) => ({ role: item.role, content: item.content }));
    const nextUserMessage: ChatMessage = { role: 'user', content: trimmed };

    setChat((prev) => [...prev, nextUserMessage]);
    setQuestion('');
    setLoading(true);
    setError('');
    try {
      const res = await axios.post<CopilotResponse>('/api/analysis/copilot', {
        symbol,
        question: trimmed,
        start_date: selectedRange?.startDate,
        end_date: selectedRange?.endDate,
        history,
      });
      const answerMeta = `${res.data.start_date} 至 ${res.data.end_date} · ${res.data.price_change_pct >= 0 ? '+' : ''}${res.data.price_change_pct.toFixed(2)}% · ${res.data.news_count} 条新闻`;
      setChat((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.answer,
          meta: answerMeta,
          keyPoints: res.data.key_points,
          riskPoints: res.data.risk_points,
        },
      ]);
    } catch (err) {
      console.error(err);
      setError('AI 分析暂时不可用，请检查模型接口配置。');
      setChat((prev) => prev.filter((item, index) => !(index === prev.length - 1 && item.role === 'user' && item.content === trimmed)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="news-panel ai-copilot-panel">
      <div className="ai-copilot-header">
        <div>
          <div className="section-eyebrow">AI 工作台</div>
          <h3>直接提问</h3>
        </div>
        <div className="ai-copilot-meta">
          {selectedRange ? `${selectedRange.startDate} 至 ${selectedRange.endDate}` : '默认读取最近 60 个交易日'}
        </div>
      </div>

      <div className="ai-copilot-presets">
        {presets.map((preset) => (
          <button key={preset} className="ai-preset-btn" onClick={() => void ask(preset)} disabled={loading}>
            {preset}
          </button>
        ))}
      </div>

      <form
        className="ai-copilot-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：这段走势是情绪主导，还是基本面主导？"
          rows={4}
        />
        <button type="submit" className="ai-submit-btn" disabled={loading || !question.trim()}>
          {loading ? '分析中...' : '发送给 AI'}
        </button>
      </form>

      {error && <div className="ai-copilot-error">{error}</div>}

      {chat.length === 0 ? (
        <div className="ai-copilot-empty">
          <p>先发一个问题。AI 会结合当前股票、区间走势和已入库新闻做回答。</p>
        </div>
      ) : (
        <div className="ai-copilot-thread">
          {chat.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ai-chat-bubble ai-chat-${message.role}`}>
              <div className="ai-chat-role">{message.role === 'user' ? '你' : 'AI'}</div>
              <p className="ai-answer">{message.content}</p>
              {message.meta && <div className="ai-chat-meta">{message.meta}</div>}
              {message.keyPoints && message.keyPoints.length > 0 && (
                <div className="ai-result-block">
                  <h4>关键信号</h4>
                  <ul>
                    {message.keyPoints.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
              {message.riskPoints && message.riskPoints.length > 0 && (
                <div className="ai-result-block">
                  <h4>风险提示</h4>
                  <ul>
                    {message.riskPoints.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="ai-chat-bubble ai-chat-assistant ai-chat-loading">
              <div className="ai-chat-role">AI</div>
              <p className="ai-answer">正在整理走势、量能和新闻上下文...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
