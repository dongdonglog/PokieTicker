import { useMemo, useState } from 'react';
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
  const [data, setData] = useState<CopilotResponse | null>(null);

  const presets = useMemo(
    () => (selectedRange ? RANGE_QUESTIONS : DEFAULT_QUESTIONS),
    [selectedRange]
  );

  async function ask(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || !symbol) return;

    setLoading(true);
    setError('');
    try {
      const res = await axios.post<CopilotResponse>('/api/analysis/copilot', {
        symbol,
        question: trimmed,
        start_date: selectedRange?.startDate,
        end_date: selectedRange?.endDate,
      });
      setData(res.data);
      setQuestion(trimmed);
    } catch (err) {
      console.error(err);
      setError('AI 分析暂时不可用，请检查模型接口配置。');
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

      {data && (
        <div className="ai-copilot-result">
          <div className="ai-result-head">
            <span>{data.symbol}</span>
            <span>{data.start_date} 至 {data.end_date}</span>
            <span className={data.price_change_pct >= 0 ? 'status-positive' : 'status-negative'}>
              {data.price_change_pct >= 0 ? '+' : ''}{data.price_change_pct.toFixed(2)}%
            </span>
          </div>
          <p className="ai-answer">{data.answer}</p>

          {data.key_points.length > 0 && (
            <div className="ai-result-block">
              <h4>关键信号</h4>
              <ul>
                {data.key_points.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          {data.risk_points.length > 0 && (
            <div className="ai-result-block">
              <h4>风险提示</h4>
              <ul>
                {data.risk_points.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
