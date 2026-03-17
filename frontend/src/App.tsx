import { useState, useEffect, useCallback, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import axios from 'axios';
import StockSelector from './components/StockSelector';
import CandlestickChart from './components/CandlestickChart';
import NewsPanel from './components/NewsPanel';
import NewsCategoryPanel from './components/NewsCategoryPanel';
import RangeAnalysisPanel from './components/RangeAnalysisPanel';
import RangeQueryPopup from './components/RangeQueryPopup';
import RangeNewsPanel from './components/RangeNewsPanel';
import SimilarDaysPanel from './components/SimilarDaysPanel';
import PredictionPanel from './components/PredictionPanel';
import './App.css';
import './workspace-layout.css';
import './workspace-panels.css';
import './workspace-forecast.css';

interface RangeSelection {
  startDate: string;
  endDate: string;
  priceChange?: number;
  popupX?: number;
  popupY?: number;
}

interface ArticleSelection {
  newsId: string;
  date: string;
}

type SidebarView = 'news' | 'signals' | 'forecast';

interface StockItem {
  symbol: string;
  last_ohlc_fetch?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  market: '市场影响',
  policy: '政策影响',
  earnings: '财报',
  product_tech: '产品与技术',
  competition: '竞争',
  management: '管理层变动',
};

interface HeaderOhlc {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
}

interface AppHeaderProps {
  activeTickers: string[];
  selectedSymbol: string;
  selectedRange: RangeSelection | null;
  hoveredOhlc: HeaderOhlc | null;
  onSelectSymbol: (symbol: string) => void;
  onAddTicker: (symbol: string) => void;
}

interface SidebarProps {
  selectedSymbol: string;
  isContextMode: boolean;
  sidebarView: SidebarView;
  sidebarTitle: string;
  sidebarCaption: string;
  modeSummary: string;
  onChangeView: (view: SidebarView) => void;
  content: ReactNode;
}

interface WorkspaceState {
  sidebarView: SidebarView;
  hoveredDate: string | null;
  hoveredOhlc: HeaderOhlc | null;
  selectedRange: RangeSelection | null;
  rangeQuestion: string | null;
  selectedDay: string | null;
  selectedArticle: ArticleSelection | null;
  lockedArticle: ArticleSelection | null;
  activeCategory: string | null;
  activeCategoryIds: string[];
  activeCategoryColor: string | null;
}

interface WorkspaceActions {
  setSidebarView: Dispatch<SetStateAction<SidebarView>>;
  handleHover: (date: string | null, ohlc?: HeaderOhlc) => void;
  handleRangeSelect: (range: RangeSelection | null) => void;
  handleArticleSelect: (article: ArticleSelection | null) => void;
  handleDayClick: (date: string) => void;
  handleRangeAsk: (question: string) => void;
  handleCategoryChange: (category: string | null, articleIds: string[], color?: string) => void;
  handleSelectSymbol: (symbol: string, onSelect: (symbol: string) => void) => void;
  clearRangeQuestion: () => void;
  clearSelectedRange: () => void;
  clearSelectedDay: () => void;
  unlockArticle: () => void;
}

function useWorkspaceState() {
  const [sidebarView, setSidebarView] = useState<SidebarView>('news');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredOhlc, setHoveredOhlc] = useState<HeaderOhlc | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeSelection | null>(null);
  const [rangeQuestion, setRangeQuestion] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleSelection | null>(null);
  const [lockedArticle, setLockedArticle] = useState<ArticleSelection | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([]);
  const [activeCategoryColor, setActiveCategoryColor] = useState<string | null>(null);

  const unlockArticle = useCallback(() => {
    setLockedArticle(null);
    setSelectedArticle(null);
  }, []);

  const handleHover = useCallback(
    (date: string | null, ohlc?: HeaderOhlc) => {
      if (!lockedArticle) {
        setHoveredDate(date);
      }
      setHoveredOhlc(ohlc || null);
    },
    [lockedArticle]
  );

  const handleRangeSelect = useCallback((range: RangeSelection | null) => {
    setSelectedRange(range);
    setRangeQuestion(null);
    if (range) {
      setSelectedDay(null);
      setSelectedArticle(null);
      setLockedArticle(null);
    }
  }, []);

  const handleArticleSelect = useCallback((article: ArticleSelection | null) => {
    if (article === null) {
      setLockedArticle(null);
      setSelectedArticle(null);
      return;
    }

    setLockedArticle((prev) => {
      if (prev && prev.newsId === article.newsId) {
        setSelectedArticle(null);
        return null;
      }
      setSelectedArticle(article);
      setSelectedRange(null);
      setRangeQuestion(null);
      setSelectedDay(null);
      setHoveredDate(article.date);
      return article;
    });
  }, []);

  const handleDayClick = useCallback((date: string) => {
    setSelectedDay(date);
    setSelectedRange(null);
    setRangeQuestion(null);
    setSelectedArticle(null);
    setLockedArticle(null);
  }, []);

  const handleRangeAsk = useCallback((question: string) => {
    setRangeQuestion(question);
  }, []);

  const handleCategoryChange = useCallback((category: string | null, articleIds: string[], color?: string) => {
    setActiveCategory(category);
    setActiveCategoryIds(articleIds);
    setActiveCategoryColor(color ?? null);
  }, []);

  const handleSelectSymbol = useCallback((symbol: string, onSelect: (symbol: string) => void) => {
    onSelect(symbol);
    setSidebarView('news');
    setHoveredDate(null);
    setHoveredOhlc(null);
    setSelectedRange(null);
    setRangeQuestion(null);
    setSelectedDay(null);
    setSelectedArticle(null);
    setLockedArticle(null);
    setActiveCategory(null);
    setActiveCategoryIds([]);
    setActiveCategoryColor(null);
  }, []);

  const clearRangeQuestion = useCallback(() => {
    setSelectedRange(null);
    setRangeQuestion(null);
  }, []);

  const clearSelectedRange = useCallback(() => {
    setSelectedRange(null);
  }, []);

  const clearSelectedDay = useCallback(() => {
    setSelectedDay(null);
  }, []);

  const state: WorkspaceState = {
    sidebarView,
    hoveredDate,
    hoveredOhlc,
    selectedRange,
    rangeQuestion,
    selectedDay,
    selectedArticle,
    lockedArticle,
    activeCategory,
    activeCategoryIds,
    activeCategoryColor,
  };

  const actions: WorkspaceActions = {
    setSidebarView,
    handleHover,
    handleRangeSelect,
    handleArticleSelect,
    handleDayClick,
    handleRangeAsk,
    handleCategoryChange,
    handleSelectSymbol,
    clearRangeQuestion,
    clearSelectedRange,
    clearSelectedDay,
    unlockArticle,
  };

  return { state, actions };
}

function AppHeader({
  activeTickers,
  selectedSymbol,
  selectedRange,
  hoveredOhlc,
  onSelectSymbol,
  onAddTicker,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left brand-block">
        <div>
          <h1>Market Copilot</h1>
          <p className="brand-tagline">导入任意市场走势，用 AI 直接提问和分析。</p>
        </div>
      </div>
      <div className="header-controls">
        <StockSelector
          activeTickers={activeTickers}
          selectedSymbol={selectedSymbol}
          onSelect={onSelectSymbol}
          onAdd={onAddTicker}
        />
        <div className="header-status">
          <span className="status-chip">{selectedSymbol || '未选择股票'}</span>
          {selectedRange ? (
            <span className="status-chip status-chip-muted">
              {selectedRange.startDate} 至 {selectedRange.endDate}
            </span>
          ) : hoveredOhlc ? (
            <>
              <span className="status-chip status-chip-muted">{hoveredOhlc.date}</span>
              <span className={`status-chip ${hoveredOhlc.change >= 0 ? 'status-positive' : 'status-negative'}`}>
                {hoveredOhlc.change >= 0 ? '+' : ''}
                {hoveredOhlc.change.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="status-chip status-chip-muted">悬停K线或框选区间</span>
          )}
        </div>
      </div>
      <div className="header-right">
        <a href="https://mitrui.com" target="_blank" rel="noopener noreferrer" className="header-link">
          mitrui.com
        </a>
        <a href="https://github.com/owengetinfo-design/PokieTicker" target="_blank" rel="noopener noreferrer" className="header-link header-github">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span className="github-text">代码仓库</span>
        </a>
      </div>
    </header>
  );
}

function Sidebar({
  selectedSymbol,
  isContextMode,
  sidebarView,
  sidebarTitle,
  sidebarCaption,
  modeSummary,
  onChangeView,
  content,
}: SidebarProps) {
  return (
    <aside className="sidebar-panel news-area">
      <div className="sidebar-header">
        <div>
          <p className="section-eyebrow">上下文</p>
          <h2>{sidebarTitle}</h2>
        </div>
        <span className="sidebar-caption">{sidebarCaption}</span>
      </div>
      {!isContextMode && selectedSymbol && (
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${sidebarView === 'news' ? 'active' : ''}`}
            onClick={() => onChangeView('news')}
          >
            新闻
          </button>
          <button
            className={`sidebar-tab ${sidebarView === 'signals' ? 'active' : ''}`}
            onClick={() => onChangeView('signals')}
          >
            事件
          </button>
          <button
            className={`sidebar-tab ${sidebarView === 'forecast' ? 'active' : ''}`}
            onClick={() => onChangeView('forecast')}
          >
            预测
          </button>
        </div>
      )}
      <div className="mode-summary">
        <span className="mode-summary-label">当前重点</span>
        <p>{modeSummary}</p>
      </div>
      <div className="sidebar-body">
        {selectedSymbol ? content : <div className="chart-placeholder">先选择股票，再加载右侧内容</div>}
      </div>
    </aside>
  );
}

function App() {
  const [activeTickers, setActiveTickers] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const {
    state: {
      sidebarView,
      hoveredDate,
      hoveredOhlc,
      selectedRange,
      rangeQuestion,
      selectedDay,
      selectedArticle,
      lockedArticle,
      activeCategory,
      activeCategoryIds,
      activeCategoryColor,
    },
    actions: {
      setSidebarView,
      handleHover,
      handleRangeSelect,
      handleArticleSelect,
      handleDayClick,
      handleRangeAsk,
      handleCategoryChange,
      handleSelectSymbol,
      clearRangeQuestion,
      clearSelectedRange,
      clearSelectedDay,
      unlockArticle,
    },
  } = useWorkspaceState();

  // Chart area ref for popup positioning
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [chartRect, setChartRect] = useState<DOMRect | undefined>(undefined);

  useEffect(() => {
    axios
      .get('/api/stocks')
      .then((res) => {
        const tickers = (res.data as StockItem[])
          .filter((t) => t.last_ohlc_fetch)
          .map((t) => t.symbol);
        setActiveTickers(tickers);
        if (tickers.length > 0 && !selectedSymbol) {
          setSelectedSymbol(tickers[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Update chartRect when range is selected (for popup positioning)
  useEffect(() => {
    if (selectedRange && chartAreaRef.current) {
      setChartRect(chartAreaRef.current.getBoundingClientRect());
    }
  }, [selectedRange]);

  function handleAddTicker(symbol: string) {
    if (!activeTickers.includes(symbol)) {
      setActiveTickers((prev) => [...prev, symbol]);
      axios.post('/api/stocks', { symbol }).catch(console.error);
    }
  }

  // Effective date for NewsPanel: locked takes priority
  const effectiveDate = lockedArticle?.date ?? hoveredDate;
  const isLocked = lockedArticle !== null;
  const isContextMode = Boolean(selectedRange || rangeQuestion || selectedDay);
  const activeCategoryLabel = activeCategory ? (CATEGORY_LABELS[activeCategory] ?? activeCategory) : null;

  function getSidebarTitle() {
    if (selectedRange && rangeQuestion) return '区间分析';
    if (selectedRange) return '区间新闻';
    if (selectedDay) return '相似交易日';
    if (sidebarView === 'forecast') return '走势预测';
    if (sidebarView === 'signals') return '事件筛选';
    return '新闻上下文';
  }

  function getSidebarCaption() {
    if (selectedRange && rangeQuestion) return `${selectedRange.startDate} to ${selectedRange.endDate}`;
    if (selectedRange) return `${selectedRange.startDate} to ${selectedRange.endDate}`;
    if (selectedDay) return selectedDay;
    if (effectiveDate) return isLocked ? `${effectiveDate} 已锁定` : effectiveDate;
    return selectedSymbol ? `${selectedSymbol} 工作区` : '先选择一只股票';
  }

  function getModeSummary() {
    if (selectedRange && rangeQuestion) return 'AI 会结合这个区间内的新闻，解释这段走势为什么发生。';
    if (selectedRange) return '先看这段区间里最强的利多和利空新闻，再决定是否继续追问。';
    if (selectedDay) return '把当前这一天和历史上最相似的交易情境做对照。';
    if (sidebarView === 'forecast') return '查看模型判断、主要驱动因素，以及相似历史区间。';
    if (sidebarView === 'signals') return activeCategoryLabel
      ? `当前按“${activeCategoryLabel}”筛选图表高亮和新闻列表。`
      : '用事件类别缩小图表高亮范围和新闻范围。';
    return isLocked
      ? '当前新闻已锁定。解锁后，悬停其他K线或点击其他新闻点即可切换上下文。'
      : '悬停K线或点击新闻点，查看该交易日背后的新闻上下文。';
  }

  function renderSidebarContent() {
    if (selectedRange && rangeQuestion) {
      return (
        <RangeAnalysisPanel
          symbol={selectedSymbol}
          startDate={selectedRange.startDate}
          endDate={selectedRange.endDate}
          question={rangeQuestion}
          onClear={clearRangeQuestion}
        />
      );
    }
    if (selectedRange && !rangeQuestion) {
      return (
        <RangeNewsPanel
          symbol={selectedSymbol}
          startDate={selectedRange.startDate}
          endDate={selectedRange.endDate}
          priceChange={selectedRange.priceChange}
          onClose={clearSelectedRange}
          onAskAI={handleRangeAsk}
        />
      );
    }
    if (selectedDay) {
      return (
        <SimilarDaysPanel
          symbol={selectedSymbol}
          date={selectedDay}
          onClose={clearSelectedDay}
        />
      );
    }

    if (sidebarView === 'forecast') {
      return <PredictionPanel symbol={selectedSymbol} />;
    }

    if (sidebarView === 'signals') {
      return (
          <div className="insight-stack">
            <div className="insight-note">
              先按事件类型缩小范围，再只看当前日期里真正相关的新闻。
            </div>
          <NewsCategoryPanel
            symbol={selectedSymbol}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
          <NewsPanel
            symbol={selectedSymbol}
            hoveredDate={effectiveDate}
            onFindSimilar={() => {
              if (effectiveDate) handleDayClick(effectiveDate);
            }}
            highlightedNewsId={selectedArticle?.newsId || null}
            isLocked={isLocked}
            onUnlock={unlockArticle}
            highlightedCategoryIds={activeCategoryIds.length > 0 ? activeCategoryIds : undefined}
          />
        </div>
      );
    }

    return (
      <NewsPanel
        symbol={selectedSymbol}
        hoveredDate={effectiveDate}
        onFindSimilar={() => {
          if (effectiveDate) handleDayClick(effectiveDate);
        }}
        highlightedNewsId={selectedArticle?.newsId || null}
        isLocked={isLocked}
        onUnlock={unlockArticle}
        highlightedCategoryIds={activeCategoryIds.length > 0 ? activeCategoryIds : undefined}
      />
    );
  }

  const sidebarTitle = getSidebarTitle();
  const sidebarCaption = getSidebarCaption();
  const modeSummary = getModeSummary();
  const sidebarContent = renderSidebarContent();

  return (
    <div className="app app-shell">
      <AppHeader
        activeTickers={activeTickers}
        selectedSymbol={selectedSymbol}
        selectedRange={selectedRange}
        hoveredOhlc={hoveredOhlc}
        onSelectSymbol={(symbol) => handleSelectSymbol(symbol, setSelectedSymbol)}
        onAddTicker={handleAddTicker}
      />

      <main className="app-main workspace">
        <section className="chart-column">
          <div className="chart-stage">
            <div className="chart-topline">
              <div>
                <p className="section-eyebrow">主图表</p>
                <h2>{selectedSymbol || '选择一只股票开始'}</h2>
              </div>
              <div className="chart-topline-meta">
                <span>{activeCategoryLabel ? `当前筛选：${activeCategoryLabel}` : '当前查看：全部事件类型'}</span>
                <span>{isLocked ? '文章已锁定' : '悬停会同步图表上下文'}</span>
              </div>
            </div>
            <div className="chart-frame chart-area" ref={chartAreaRef}>
              {selectedSymbol ? (
                <>
                  <CandlestickChart
                    symbol={selectedSymbol}
                    lockedNewsId={lockedArticle?.newsId ?? null}
                    highlightedArticleIds={activeCategoryIds.length > 0 ? activeCategoryIds : null}
                    highlightColor={activeCategoryColor}
                    onHover={handleHover}
                    onRangeSelect={handleRangeSelect}
                    onArticleSelect={handleArticleSelect}
                    onDayClick={handleDayClick}
                  />
                  {selectedRange && !rangeQuestion && (
                    <RangeQueryPopup
                      range={selectedRange}
                      chartRect={chartRect}
                      onAsk={handleRangeAsk}
                      onClose={clearSelectedRange}
                    />
                  )}
                </>
              ) : (
                <div className="chart-placeholder">选择股票后即可查看图表</div>
              )}
            </div>
            <div className="chart-toolbar">
              <div className="toolbar-group">
                <span className="toolbar-label">阅读方式</span>
                <span className="toolbar-text">悬停K线看上下文，点击新闻点锁定，框选区间后直接追问原因。</span>
              </div>
              <div className="toolbar-group toolbar-metrics">
                {hoveredOhlc && !selectedRange && (
                  <>
                    <span>O {hoveredOhlc.open.toFixed(2)}</span>
                    <span>H {hoveredOhlc.high.toFixed(2)}</span>
                    <span>L {hoveredOhlc.low.toFixed(2)}</span>
                    <span>C {hoveredOhlc.close.toFixed(2)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
        <Sidebar
          selectedSymbol={selectedSymbol}
          isContextMode={isContextMode}
          sidebarView={sidebarView}
          sidebarTitle={sidebarTitle}
          sidebarCaption={sidebarCaption}
          modeSummary={modeSummary}
          onChangeView={setSidebarView}
          content={sidebarContent}
        />
      </main>
    </div>
  );
}

export default App;
