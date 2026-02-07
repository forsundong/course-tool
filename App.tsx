
import React, { useState, useRef, useMemo } from 'react';
import { 
  Search, Copy, Download, Loader2, Check, Hash, Database, 
  ShieldAlert, Table as TableIcon, Tag, ClipboardList, 
  Upload, FileJson, MapPin, PanelLeftClose, PanelLeft, 
  ExternalLink, Layers, Video as VideoIcon, Fingerprint,
  Files, MoreHorizontal, AlertCircle, HelpCircle,
  LayoutDashboard, BookOpen, BarChart3, ChevronRight,
  Filter, GitCompare, History, Sparkles, X, MousePointer2,
  Clock
} from 'lucide-react';
import { fetchCoursePathData, processJsonData } from './services/courseService';
import { CourseExtractionResult, GroupOption, ElementType } from './types';

type QuestionFilterType = 'all' | 'morton' | 'rd';

const App: React.FC = () => {
  const [pathId, setPathId] = useState<string>('8333');
  const [oldPathIds, setOldPathIds] = useState<string>(''); 
  const [loading, setLoading] = useState<boolean>(false);
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CourseExtractionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  
  // 进度状态
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);

  // 对比功能相关状态
  const [oldPathKeys, setOldPathKeys] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState<boolean>(false);

  const [elementType, setElementType] = useState<ElementType>('CalculusBoard');
  const [questionFilter, setQuestionFilter] = useState<QuestionFilterType>('all');
  const [groupOption, setGroupOption] = useState<GroupOption>('none');
  const [showSidebar, setShowSidebar] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFetch = async () => {
    if (!pathId.trim()) return;
    setLoading(true); 
    setError(null); 
    setData(null);
    setProgress({ percent: 15, message: `连接 Merton API...` });
    
    try {
      // 模拟阶段性进度
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          if (!prev || prev.percent >= 85) return prev;
          return { ...prev, percent: prev.percent + 5, message: `正在接收数据并解析...` };
        });
      }, 200);

      const res = await fetchCoursePathData(pathId);
      clearInterval(progressTimer);
      
      setProgress({ percent: 100, message: '解析完成' });
      setData(res);
      setTimeout(() => setProgress(null), 600);
    } catch (err: any) { 
      setError(err.message || '获取失败'); 
      setProgress(null);
    }
    finally { setLoading(false); }
  };

  const handleCompare = async () => {
    const ids = oldPathIds.split(/[\n,，]/).map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length === 0) return;
    
    setCompareLoading(true);
    setError(null);
    const total = ids.length;
    let completedCount = 0;
    
    setProgress({ percent: 10, message: `开始并行获取 ${total} 个对比路径...` });

    try {
      const allKeys = new Set<string>();
      
      // 使用 Promise.all 并行请求所有路径，显著提升速度
      const fetchPromises = ids.map(async (id) => {
        try {
          const res = await fetchCoursePathData(id);
          completedCount++;
          const percent = Math.round((completedCount / total) * 90) + 5;
          setProgress({ percent, message: `已完成 ${completedCount}/${total}: 正在拉取 ${id}` });
          return res;
        } catch (e) {
          completedCount++;
          console.warn(`路径 ${id} 对比数据拉取失败`);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      
      results.forEach(res => {
        if (res) res.nodes.forEach(n => allKeys.add(n.key));
      });

      setProgress({ percent: 100, message: '全量比对分析完成' });
      setOldPathKeys(allKeys);
      setTimeout(() => setProgress(null), 600);
    } catch (err: any) {
      setError(`比对执行过程中出现错误: ${err.message}`);
      setProgress(null);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    setLoading(true); setError(null);
    setProgress({ percent: 30, message: '正在加载本地文件内容...' });
    
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setProgress({ percent: 70, message: '执行本地结构化解析...' });
        
        // 使用 setTimeout 确保 UI 线程可以渲染进度更新
        setTimeout(() => {
          const res = processJsonData(json, file.name);
          setData(res);
          setProgress({ percent: 100, message: '解析成功' });
          setTimeout(() => setProgress(null), 600);
          setLoading(false);
        }, 10);
      } catch (err) { 
        setError('JSON 解析失败'); 
        setProgress(null);
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    let nodes = data.nodes.filter(n => String(n.objectType).toLowerCase() === elementType.toLowerCase());
    if (elementType === 'CalculusBoard') {
      if (questionFilter === 'morton') nodes = nodes.filter(n => n.questionType === '莫顿题');
      else if (questionFilter === 'rd') nodes = nodes.filter(n => n.questionType === '研发题');
    }
    return nodes;
  }, [data, elementType, questionFilter]);

  const stats = useMemo(() => {
    if (!data) return null;
    const duplicates = Array.from(oldPathKeys).length > 0 
      ? filteredNodes.filter(n => oldPathKeys.has(n.key)).length 
      : 0;

    return {
      total: data.nodes.length,
      boards: data.nodes.filter(n => String(n.objectType).toLowerCase() === 'calculusboard').length,
      videos: data.nodes.filter(n => String(n.objectType).toLowerCase() === 'video').length,
      morton: data.nodes.filter(n => n.questionType === '莫顿题').length,
      duplicates: duplicates
    };
  }, [data, filteredNodes, oldPathKeys]);

  const groupedData = useMemo(() => {
    const groups: Record<string, typeof filteredNodes> = {};
    filteredNodes.forEach(n => {
      let key = '未分类';
      if (groupOption === 'knowledge') key = n.knowledgePoints.join(' / ') || '无知识点';
      else if (groupOption === 'scene') key = `${n.sceneName} (ID: ${n.sceneId})`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  }, [filteredNodes, groupOption]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAllKeys = () => {
    if (filteredNodes.length === 0) return;
    const allKeys = filteredNodes.map(n => n.key).join('\n');
    copyToClipboard(allKeys, 'all-keys');
  };

  const exportCsv = () => {
    if (!data) return;
    const headers = ['序号', 'KEY', '名称', '场景名称', '题目类型', '错X次跳关', '知识点', '视频链接', '是否重复'];
    const rows = filteredNodes.map((n, i) => [
      i + 1, n.key, n.boardName, n.sceneName, n.questionType, n.errorCount, n.knowledgePoints.join('; '), n.videoUrl || '-', oldPathKeys.has(n.key) ? '是' : '否'
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Merton_Export_${data.pathId}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen flex bg-[#fcfdfe] font-sans text-slate-800 text-[14px]">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-rose-500 rounded-full blur-[100px]"></div>
      </div>

      {/* 顶部全局进度条：优化平滑度 */}
      {progress && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1.5 bg-slate-100 overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          ></div>
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white shadow-2xl px-5 py-2.5 rounded-2xl border border-indigo-100 flex items-center gap-4 animate-in slide-in-from-top-4 backdrop-blur-md">
            <Loader2 className="animate-spin text-indigo-600 w-4 h-4" />
            <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">正在处理中</span>
               <span className="text-[12px] font-bold text-slate-700">{progress.message}</span>
            </div>
            <div className="h-6 w-px bg-slate-100 mx-1"></div>
            <span className="text-sm font-black text-indigo-600 tabular-nums">{progress.percent}%</span>
          </div>
        </div>
      )}

      {data && groupOption !== 'none' && (
        <aside className={`bg-white/80 backdrop-blur-xl border-r border-slate-200/60 transition-all duration-300 flex-shrink-0 sticky top-0 h-screen overflow-y-auto z-40 ${showSidebar ? 'w-72' : 'w-0 opacity-0 overflow-hidden'}`}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">分组视图</h3>
              </div>
              <button onClick={() => setShowSidebar(false)} className="text-slate-400 hover:text-slate-900 transition-colors p-1 hover:bg-slate-100 rounded">
                <PanelLeftClose size={16} />
              </button>
            </div>
            
            <nav className="space-y-1.5">
              {Object.keys(groupedData).map((group, idx) => (
                <button
                  key={idx}
                  onClick={() => document.getElementById(`group-${idx}`)?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full text-left p-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-700 transition-all flex items-center justify-between group/nav relative overflow-hidden"
                >
                  <span className="truncate pr-2 relative z-10">{group}</span>
                  <div className="bg-slate-100 group-hover/nav:bg-white px-2 py-0.5 rounded-lg text-[10px] text-slate-400 group-hover/nav:text-indigo-600 font-black shadow-sm relative z-10">
                    {groupedData[group].length}
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 scale-y-0 group-hover/nav:scale-y-100 transition-transform origin-center"></div>
                </button>
              ))}
            </nav>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6">
            {data && groupOption !== 'none' && !showSidebar && (
              <button onClick={() => setShowSidebar(true)} className="p-2 hover:bg-white rounded-xl text-slate-500 transition-all shadow-sm border border-slate-100">
                <PanelLeft size={20} />
              </button>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5">
                <div className="bg-slate-900 p-2 rounded-xl shadow-lg rotate-3 group hover:rotate-0 transition-transform cursor-default">
                  <Database className="text-white w-5 h-5" />
                </div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">Merton Path <span className="text-indigo-600">Extractor</span></h1>
              </div>
              {data && <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 pl-1">Target Path: <span className="text-slate-600">{data.title}</span></p>}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group/search">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/search:text-indigo-500 transition-colors w-4 h-4" />
              <input 
                type="text" value={pathId} onChange={e => setPathId(e.target.value)}
                placeholder="路径 ID" className="pl-10 pr-4 py-2.5 bg-slate-100/50 border border-slate-200/60 rounded-xl text-sm w-36 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
                onKeyDown={e => e.key === 'Enter' && handleFetch()}
              />
            </div>
            <button 
              onClick={handleFetch} 
              disabled={loading} 
              className="px-6 py-2.5 bg-slate-900 text-white text-sm font-black rounded-xl hover:bg-black hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-slate-900/10"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />} 获取
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".json" />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="p-2.5 border border-slate-200/60 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-all hover:shadow-md active:scale-95 shadow-sm"
              title="本地上传分析"
            >
              <Upload className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-8 max-w-[1600px] mx-auto w-full space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300">
              <ShieldAlert className="shrink-0" size={20} /> {error}
            </div>
          )}

          {data && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-indigo-100">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Layers size={22} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">总节点</p>
                  <p className="text-xl font-black text-slate-900">{stats?.total}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-emerald-100">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TableIcon size={22} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">演算板</p>
                  <p className="text-xl font-black text-slate-900">{stats?.boards}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-rose-100">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><VideoIcon size={22} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">视频节点</p>
                  <p className="text-xl font-black text-slate-900">{stats?.videos}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-amber-100">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><HelpCircle size={22} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">莫顿题量</p>
                  <p className="text-xl font-black text-slate-900">{stats?.morton}</p>
                </div>
              </div>
              <div className={`p-5 rounded-3xl border transition-all hover:shadow-md flex items-center gap-4 ${stats?.duplicates && stats.duplicates > 0 ? 'bg-amber-50 border-amber-200 shadow-amber-900/5' : 'bg-white border-slate-100'}`}>
                <div className={`p-3 rounded-2xl ${stats?.duplicates && stats.duplicates > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-300'}`}><GitCompare size={22} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">重复题目</p>
                  <p className={`text-xl font-black ${stats?.duplicates && stats.duplicates > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{stats?.duplicates || 0}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/60 backdrop-blur-sm p-5 rounded-3xl border border-slate-200/60 shadow-xl shadow-indigo-900/5 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">内容分类</span>
                <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/40">
                  <button 
                    onClick={() => { setElementType('CalculusBoard'); setQuestionFilter('all'); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${elementType === 'CalculusBoard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <TableIcon size={14} /> 演算板
                  </button>
                  <button 
                    onClick={() => setElementType('Video')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${elementType === 'Video' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <VideoIcon size={14} /> 视频
                  </button>
                </div>
              </div>

              {elementType === 'CalculusBoard' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">题目类型细分</span>
                  <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/40">
                    <button 
                      onClick={() => setQuestionFilter('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${questionFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      全部
                    </button>
                    <button 
                      onClick={() => setQuestionFilter('morton')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${questionFilter === 'morton' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      莫顿题
                    </button>
                    <button 
                      onClick={() => setQuestionFilter('rd')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${questionFilter === 'rd' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      研发题
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">多路径对比</span>
                <button 
                  onClick={() => setShowCompare(!showCompare)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black border transition-all ${showCompare ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                >
                  <GitCompare size={14} /> {showCompare ? '比对已开启' : '开启比对'}
                </button>
              </div>
            </div>

            {data && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <button onClick={copyAllKeys} className="px-5 py-2.5 bg-white text-indigo-600 border border-indigo-100 rounded-2xl text-xs font-black hover:bg-indigo-50 hover:shadow-lg transition-all flex items-center gap-2 group/copy">
                    {copied === 'all-keys' ? <Check size={16} className="text-emerald-500" /> : <Files size={16} className="group-hover/copy:rotate-12 transition-transform" />} 
                    复制当前 {filteredNodes.length} 个 KEY
                  </button>
                </div>
                <button onClick={exportCsv} className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-black flex items-center gap-2 shadow-xl shadow-slate-900/10 transition-all active:scale-95">
                  <Download size={16} /> 导出 CSV
                </button>
              </div>
            )}
          </div>

          {/* Comparison Control Panel */}
          {showCompare && (
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-[32px] p-8 flex flex-col md:flex-row items-stretch justify-between gap-8 animate-in slide-in-from-top-4 duration-500 shadow-inner">
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm border border-indigo-50 flex items-center justify-center">
                    <History size={24} />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">多路径对比分析器</h4>
                </div>
                <p className="text-xs text-slate-500 font-bold max-w-lg leading-relaxed">
                  下方输入框支持多个路径 ID。所有请求将<span className="text-indigo-600">并行处理</span>以提升速度。请使用换行或逗号分隔。
                </p>
                {compareLoading && (
                  <div className="flex items-center gap-3 text-indigo-600 font-black text-[10px] uppercase tracking-widest animate-pulse">
                    <Clock size={14} /> 正在并发请求所有路径数据...
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 w-full md:w-80">
                <div className="relative group/oldsearch h-32">
                  <textarea 
                    value={oldPathIds} onChange={e => setOldPathIds(e.target.value)}
                    placeholder="输入旧路径 IDs...&#10;8331&#10;8332, 8333" 
                    className="w-full h-full pl-4 pr-4 py-3 bg-white border border-indigo-100 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none font-mono font-bold placeholder:text-slate-300 resize-none leading-relaxed transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleCompare}
                    disabled={compareLoading || !oldPathIds.trim()}
                    className="flex-1 py-3 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                  >
                    {compareLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles size={14} />} 运行比对分析
                  </button>
                  {oldPathKeys.size > 0 && (
                    <button 
                      onClick={() => {setOldPathKeys(new Set()); setOldPathIds('');}}
                      className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-xl border border-indigo-50 transition-all hover:bg-rose-50"
                      title="清除比对数据"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {data ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {Object.keys(groupedData).map((groupName, groupIdx) => (
                <div key={groupIdx} id={`group-${groupIdx}`} className="space-y-5 scroll-mt-28">
                  {groupOption !== 'none' && (
                    <div className="flex items-center gap-4 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                          <span className="text-sm font-black">{groupIdx + 1}</span>
                        </div>
                        <div className="flex flex-col">
                          <h3 className="text-base font-black text-slate-900 tracking-tight">{groupName}</h3>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">包含 {groupedData[groupName].length} 个元素</span>
                        </div>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200/60 rounded-[32px] overflow-hidden shadow-2xl shadow-indigo-900/5 transition-all">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="pl-8 pr-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">NO.</th>
                          <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">基础信息</th>
                          <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            KEY / 关卡标识 <MousePointer2 size={10} className="text-indigo-400" />
                          </th>
                          <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">业务逻辑</th>
                          <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">环境信息</th>
                          <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            知识点清单 <MousePointer2 size={10} className="text-emerald-400" />
                          </th>
                          <th className="pl-4 pr-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">动作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {groupedData[groupName].length > 0 ? groupedData[groupName].map((node, idx) => {
                          const isDuplicate = oldPathKeys.has(node.key);
                          const nodeKeyId = `k-${groupIdx}-${idx}`;
                          const nodeKpId = `kp-${groupIdx}-${idx}`;
                          
                          return (
                            <tr key={idx} className={`transition-all group/row ${isDuplicate ? 'bg-amber-50/30 hover:bg-amber-100/40 border-l-4 border-l-amber-400' : 'hover:bg-indigo-50/20'}`}>
                              <td className="pl-8 pr-4 py-6 text-slate-300 font-black text-center text-xs tabular-nums">{idx + 1}</td>
                              <td className="px-4 py-6">
                                <div className="flex items-center gap-4">
                                  <div className={`w-2 h-8 rounded-full shrink-0 shadow-sm ${node.objectType.toLowerCase() === 'video' ? 'bg-rose-500 shadow-rose-200' : 'bg-indigo-500 shadow-indigo-200'}`}></div>
                                  <div className="flex flex-col">
                                    <span className="font-black text-slate-900 text-sm leading-tight">{node.boardName}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{node.objectType}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-6">
                                <div className="relative group/key w-fit">
                                  <div 
                                    onClick={() => copyToClipboard(node.key, nodeKeyId)}
                                    className={`px-4 py-2 rounded-xl font-mono text-base font-black border shadow-xl shadow-slate-900/5 leading-none min-w-[120px] text-center transition-all cursor-pointer select-none active:scale-95 ${isDuplicate ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-900 text-white border-slate-800 hover:bg-black hover:shadow-indigo-500/20'}`}
                                  >
                                    {node.key}
                                  </div>
                                  {copied === nodeKeyId && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg animate-in fade-in zoom-in slide-in-from-bottom-2 flex items-center gap-1">
                                      <Check size={10} /> 已复制
                                    </div>
                                  )}
                                  {isDuplicate && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-amber-400 whitespace-nowrap z-10 animate-pulse">
                                      DUPLICATE
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-6">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center">
                                    {node.questionType === '莫顿题' ? (
                                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                                        <HelpCircle size={12} className="mr-1.5" /> 莫顿题
                                      </span>
                                    ) : node.questionType === '研发题' ? (
                                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                                        <AlertCircle size={12} className="mr-1.5" /> 研发题
                                      </span>
                                    ) : (
                                      <span className="text-slate-200 font-black text-[10px] tracking-widest">NULL</span>
                                    )}
                                  </div>
                                  {node.errorCount !== "-" && (
                                    <span className="font-black text-slate-700 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-[10px] w-fit shadow-sm">
                                      错 <span className="text-indigo-600">{node.errorCount}</span> 次跳关
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-6">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                                    <div className="bg-slate-100 p-1.5 rounded-lg text-slate-400 group-hover/row:bg-white transition-colors">
                                      <MapPin size={12} />
                                    </div>
                                    <span className="truncate max-w-[120px]">{node.sceneName}</span>
                                  </div>
                                  <span className="text-[9px] text-slate-300 font-black pl-8 tracking-widest uppercase"># {node.sceneId}</span>
                                </div>
                              </td>
                              <td className="px-4 py-6">
                                <div className="relative group/kp">
                                  <div 
                                    onClick={() => node.knowledgePoints.length > 0 && copyToClipboard(node.knowledgePoints.join(', '), nodeKpId)}
                                    className={`flex flex-wrap gap-1.5 min-w-[200px] p-2 rounded-2xl transition-all select-none ${node.knowledgePoints.length > 0 ? 'cursor-pointer hover:bg-emerald-50/50' : ''}`}
                                  >
                                    {node.knowledgePoints.length > 0 ? node.knowledgePoints.map((kp, kidx) => (
                                      <span key={kidx} className="bg-emerald-50 text-emerald-800 border border-emerald-100/60 px-3 py-1.5 rounded-xl text-sm font-black shadow-sm group-hover/row:bg-white group-hover/row:border-emerald-200 transition-all">{kp}</span>
                                    )) : <span className="text-[10px] text-slate-300 font-black italic tracking-widest py-2">无知识点</span>}
                                  </div>
                                  {copied === nodeKpId && (
                                    <div className="absolute -top-6 left-4 bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg animate-in fade-in zoom-in slide-in-from-bottom-2 flex items-center gap-1">
                                      <Check size={10} /> 知识点已复制
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="pl-4 pr-8 py-6 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  {node.videoUrl && (
                                    <a 
                                      href={node.videoUrl} 
                                      target="_blank" 
                                      className="group/btn flex items-center gap-2 text-[10px] font-black text-white bg-indigo-600 px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
                                    >
                                      <VideoIcon size={14} className="group-hover/btn:scale-110 transition-transform" /> 预览
                                    </a>
                                  )}
                                  <div className="text-slate-100 group-hover/row:text-slate-300 transition-colors p-1">
                                    <MoreHorizontal size={20} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={7} className="py-24 text-center">
                              <div className="flex flex-col items-center gap-3 opacity-20">
                                <Filter size={48} />
                                <span className="text-sm font-black uppercase tracking-widest">无符合筛选条件的项</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="bg-white p-12 rounded-[40px] shadow-2xl shadow-indigo-500/10 border border-slate-100 relative z-10 group hover:rotate-2 transition-transform">
                  <FileJson size={80} className="text-indigo-600/20 group-hover:text-indigo-600 transition-colors" />
                </div>
              </div>
              <div className="text-center space-y-3 max-w-sm">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">就绪，等待分析</h2>
                <p className="text-slate-400 text-sm font-bold leading-relaxed">请输入路径 ID 或点击比对功能开始工作。数据解析全流程在本地执行。</p>
                <div className="pt-4 flex justify-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce [animation-delay:-0.3s]"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Decorative Elements */}
      <footer className="fixed bottom-6 left-8 pointer-events-none opacity-40 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-4 z-50">
        <LayoutDashboard size={14} /> Merton Content Ops Platform
      </footer>
      
      <div className="fixed bottom-8 right-8 z-50">
        <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 animate-in slide-in-from-right-4 duration-500">
          <BarChart3 size={16} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest">Secure & Offline</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default App;
