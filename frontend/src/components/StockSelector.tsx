import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Ticker {
  symbol: string;
  name: string;
  sector?: string;
}

interface GroupTicker {
  symbol: string;
  name: string;
}

interface Props {
  activeTickers: string[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  onAdd: (symbol: string) => void;
}

const GROUPS: Record<string, GroupTicker[]> = {
  '科技': [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'GOOG', name: 'Alphabet C' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'CRM', name: 'Salesforce' },
    { symbol: 'ORCL', name: 'Oracle' },
    { symbol: 'IBM', name: 'IBM' },
    { symbol: 'CSCO', name: 'Cisco' },
    { symbol: 'NOW', name: 'ServiceNow' },
    { symbol: 'WDAY', name: 'Workday' },
    { symbol: 'SNOW', name: 'Snowflake' },
    { symbol: 'DELL', name: 'Dell' },
    { symbol: 'ADBE', name: 'Adobe' },
  ],
  'AI / 芯片': [
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'AMD', name: 'AMD' },
    { symbol: 'TSM', name: 'TSMC ADR' },
    { symbol: 'AVGO', name: 'Broadcom' },
    { symbol: 'INTC', name: 'Intel' },
    { symbol: 'QCOM', name: 'Qualcomm' },
    { symbol: 'ARM', name: 'Arm' },
    { symbol: 'AMAT', name: 'Applied Materials' },
    { symbol: 'LRCX', name: 'Lam Research' },
    { symbol: 'MU', name: 'Micron' },
    { symbol: 'MRVL', name: 'Marvell' },
    { symbol: 'SMCI', name: 'Supermicro' },
    { symbol: 'CRWV', name: 'CoreWeave' },
    { symbol: 'TXN', name: 'Texas Instruments' },
    { symbol: 'ASML', name: 'ASML' },
  ],
  'AI 软件': [
    { symbol: 'AI', name: 'C3.ai' },
    { symbol: 'SOUN', name: 'SoundHound' },
    { symbol: 'SOUNW', name: 'SoundHound Warrants' },
    { symbol: 'CRWD', name: 'CrowdStrike' },
    { symbol: 'ANET', name: 'Arista' },
    { symbol: 'IDCC', name: 'InterDigital' },
  ],
  '新能源车': [
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'RIVN', name: 'Rivian' },
    { symbol: 'LCID', name: 'Lucid' },
    { symbol: 'NIO', name: 'NIO' },
    { symbol: 'LI', name: 'Li Auto' },
    { symbol: 'BYDDY', name: 'BYD ADR' },
    { symbol: 'F', name: 'Ford' },
    { symbol: 'GM', name: 'GM' },
    { symbol: 'STLA', name: 'Stellantis' },
    { symbol: 'TM', name: 'Toyota' },
  ],
  '中概股': [
    { symbol: 'BABA', name: 'Alibaba' },
    { symbol: 'JD', name: 'JD.com' },
    { symbol: 'BIDU', name: 'Baidu' },
    { symbol: 'NIO', name: 'NIO' },
    { symbol: 'LI', name: 'Li Auto' },
    { symbol: 'BILI', name: 'Bilibili' },
    { symbol: 'NTES', name: 'NetEase' },
    { symbol: 'SE', name: 'Sea' },
    { symbol: 'MCHI', name: 'iShares China' },
    { symbol: 'FXI', name: 'China Large-Cap ETF' },
  ],
  '金融': [
    { symbol: 'V', name: 'Visa' },
    { symbol: 'MA', name: 'Mastercard' },
    { symbol: 'GS', name: 'Goldman Sachs' },
    { symbol: 'MS', name: 'Morgan Stanley' },
    { symbol: 'BAC', name: 'Bank of America' },
    { symbol: 'WFC', name: 'Wells Fargo' },
    { symbol: 'C', name: 'Citigroup' },
    { symbol: 'BLK', name: 'BlackRock' },
    { symbol: 'COIN', name: 'Coinbase' },
    { symbol: 'HOOD', name: 'Robinhood' },
    { symbol: 'MARA', name: 'Marathon Digital' },
  ],
  '媒体': [
    { symbol: 'NFLX', name: 'Netflix' },
    { symbol: 'DIS', name: 'Disney' },
    { symbol: 'ROKU', name: 'Roku' },
    { symbol: 'WBD', name: 'Warner Bros. Discovery' },
    { symbol: 'ZM', name: 'Zoom' },
  ],
  '消费': [
    { symbol: 'COST', name: 'Costco' },
    { symbol: 'WMT', name: 'Walmart' },
    { symbol: 'HD', name: 'Home Depot' },
    { symbol: 'TGT', name: 'Target' },
    { symbol: 'NKE', name: 'Nike' },
    { symbol: 'SBUX', name: 'Starbucks' },
    { symbol: 'MCD', name: 'McDonald\'s' },
    { symbol: 'CMG', name: 'Chipotle' },
    { symbol: 'KO', name: 'Coca-Cola' },
    { symbol: 'EBAY', name: 'eBay' },
    { symbol: 'MELI', name: 'Mercado Libre' },
  ],
  '医疗': [
    { symbol: 'UNH', name: 'UnitedHealth' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' },
    { symbol: 'LLY', name: 'Eli Lilly' },
    { symbol: 'MRNA', name: 'Moderna' },
    { symbol: 'NVO', name: 'Novo Nordisk' },
  ],
  '能源': [
    { symbol: 'XOM', name: 'ExxonMobil' },
    { symbol: 'CVX', name: 'Chevron' },
    { symbol: 'OXY', name: 'Occidental' },
    { symbol: 'XLE', name: 'Energy ETF' },
    { symbol: 'USO', name: 'Oil Fund' },
  ],
  '通信': [
    { symbol: 'T', name: 'AT&T' },
    { symbol: 'VZ', name: 'Verizon' },
  ],
  '其他': [
    { symbol: 'BA', name: 'Boeing' },
    { symbol: 'UBER', name: 'Uber' },
    { symbol: 'GME', name: 'GameStop' },
    { symbol: 'AMC', name: 'AMC' },
    { symbol: 'MULN', name: 'Mullen' },
    { symbol: 'SQ', name: 'Block' },
    { symbol: 'FB', name: 'Meta Legacy' },
    { symbol: 'AMJB', name: 'Alerian MLP ETN' },
    { symbol: 'GLD', name: 'Gold ETF' },
    { symbol: 'XLU', name: 'Utilities ETF' },
    { symbol: 'XLY', name: 'Consumer ETF' },
    { symbol: 'DIDI', name: 'DiDi' },
  ],
};

export default function StockSelector({ activeTickers, selectedSymbol, onSelect, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ticker[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 1) {
      setResults([]);
      setShowSearch(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/stocks/search?q=${encodeURIComponent(q)}`);
        setResults(res.data);
        setShowSearch(true);
      } catch {
        setResults([]);
      }
    }, 300);
  }

  function handlePick(ticker: Ticker) {
    setQuery('');
    setShowSearch(false);
    setShowPanel(false);
    if (!activeTickers.includes(ticker.symbol)) {
      onAdd(ticker.symbol);
    }
    onSelect(ticker.symbol);
  }

  const activeSet = new Set(activeTickers);
  const importedTickers = activeTickers
    .filter((symbol) => !Object.values(GROUPS).some((group) => group.some((ticker) => ticker.symbol === symbol)))
    .sort()
    .map((symbol) => ({ symbol, name: symbol }));

  const renderedGroups = [
    ...(importedTickers.length > 0 ? [{ label: '已导入数据', tickers: importedTickers }] : []),
    ...Object.entries(GROUPS)
      .map(([label, tickers]) => ({
        label,
        tickers: tickers.filter((ticker) => activeSet.has(ticker.symbol)),
      }))
      .filter((group) => group.tickers.length > 0),
  ];

  return (
    <div className="stock-selector">
      {/* Current ticker button — click to open dropdown */}
      <div className="ticker-dropdown-wrapper" ref={panelRef}>
        <button
          className="ticker-current"
          onClick={() => setShowPanel((v) => !v)}
        >
          <span className="ticker-current-symbol">{selectedSymbol || '---'}</span>
          <span className={`ticker-arrow ${showPanel ? 'open' : ''}`}>&#9662;</span>
        </button>

        {showPanel && (
          <div className="ticker-panel">
            {renderedGroups.map((group) => (
              <div className="ticker-panel-group" key={group.label}>
                <div className="ticker-panel-group-label">{group.label}</div>
                <div className="ticker-panel-group-items">
                  {group.tickers.map((ticker) => (
                    <button
                      key={ticker.symbol}
                      className={`ticker-panel-item ${ticker.symbol === selectedSymbol ? 'active' : ''}`}
                      onClick={() => handlePick({ symbol: ticker.symbol, name: ticker.name })}
                      title={ticker.name}
                    >
                      {ticker.symbol}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="search-wrapper" ref={searchRef}>
        <input
          type="text"
          placeholder="搜索代码或导入后的 symbol..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowSearch(true)}
        />
        {showSearch && results.length > 0 && (
          <ul className="search-dropdown">
            {results.map((t) => (
              <li key={t.symbol} onClick={() => handlePick(t)}>
                <strong>{t.name}</strong> <span>{t.symbol}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
