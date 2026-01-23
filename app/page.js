'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Trophy, Users, BookOpen, ChevronDown, Search, PlusCircle, Settings, Link, RefreshCw, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react';

// --- 設定：班級專屬背景色票 (柔和色系) ---
const CLASS_BG_COLORS = [
  'bg-red-50', 'bg-orange-50', 'bg-amber-50', 'bg-yellow-50', 'bg-lime-50',
  'bg-green-50', 'bg-emerald-50', 'bg-teal-50', 'bg-cyan-50', 'bg-sky-50',
  'bg-blue-50', 'bg-indigo-50', 'bg-violet-50', 'bg-purple-50', 'bg-fuchsia-50',
  'bg-pink-50', 'bg-rose-50', 'bg-slate-100', 'bg-gray-100', 'bg-stone-100'
];

// 輔助：根據班級名稱產生固定的顏色
const getClassColor = (className) => {
  if (!className) return 'bg-white';
  let hash = 0;
  const str = String(className);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CLASS_BG_COLORS.length;
  return CLASS_BG_COLORS[index];
};

// --- 初始資料產生器 ---
const generateClassData = (className, examId) => {
  const students = [];
  const count = 3; 
  for (let i = 1; i <= count; i++) {
    const baseScore = 60 + Math.floor(Math.random() * 40);
    students.push({
      class: className,
      seat: i,
      name: `${className}-學生${String.fromCharCode(64 + i)}`,
      chi: baseScore,
      eng: baseScore - 5 + Math.floor(Math.random() * 10),
      math: baseScore - 10 + Math.floor(Math.random() * 20),
      sci: baseScore,
      geo: baseScore,
      hist: baseScore,
      civ: baseScore,
    });
  }
  return students;
};

// 輔助計算
const processGrades = (student) => {
  const parseScore = (val) => Number(val) || 0;
  
  const geo = parseScore(student.geo);
  const hist = parseScore(student.hist);
  const civ = parseScore(student.civ);
  
  const social = Math.round(((geo + hist + civ) / 3) * 10) / 10;
  
  const total = parseScore(student.chi) + 
                parseScore(student.eng) + 
                parseScore(student.math) + 
                parseScore(student.sci) + 
                social;
                
  return { ...student, social, total: Math.round(total * 10) / 10 };
};

export default function DynamicGradeSystem() {
  // --- 狀態控制 ---
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [exams, setExams] = useState([
    { id: 'Exam1', label: '112上-第一次段考' },
    { id: 'Exam2', label: '112上-第二次段考' },
  ]);
  const [classes, setClasses] = useState(['701', '702']);

  const [database, setDatabase] = useState({});
  const [currentExam, setCurrentExam] = useState('Exam1');
  const [viewMode, setViewMode] = useState('school'); // 'school' | 'class' | 'analysis'
  const [showAdminPanel, setShowAdminPanel] = useState(true);

  // --- 抓取設定 ---
  const fetchSettings = useCallback(async (url) => {
    if (!url) return;
    setIsConfigLoading(true);
    setErrorMsg('');
    try {
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getSettings&t=${new Date().getTime()}`;
      const response = await fetch(fetchUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
      if (!response.ok) throw new Error('讀取設定失敗');
      const data = await response.json();
      
      if (data.exams && data.exams.length > 0) {
        setExams(data.exams);
        // 使用 functional update 確保 currentExam 是最新的
        setCurrentExam(prev => {
           const currentExists = data.exams.some(e => e.id === prev);
           return currentExists ? prev : data.exams[0].id;
        });
      }
      if (data.classes && data.classes.length > 0) {
        setClasses(data.classes);
      }
      setSuccessMsg('已成功連線並同步 Master Sheet 設定！');
    } catch (err) {
      console.error('Config Fetch Error:', err);
      setErrorMsg('連線成功，但無法讀取設定 (可能是 Master Sheet 缺少 Exam_Settings 分頁，將使用預設清單)');
    } finally {
      setIsConfigLoading(false);
    }
  }, []); // 空依賴陣列，因為它只依賴穩定的 fetch

  // --- 抓取成績資料 ---
  const fetchLiveData = useCallback(async (examId) => {
    const targetUrlRaw = googleScriptUrl.trim();
    if (!targetUrlRaw) {
      setErrorMsg('請輸入 Apps Script 網址');
      return;
    }
    if (targetUrlRaw.includes('/edit')) {
      setErrorMsg('網址錯誤：請使用 /exec 結尾的部署網址');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const fetchUrl = `${targetUrlRaw}${targetUrlRaw.includes('?') ? '&' : '?'}exam=${examId}&t=${new Date().getTime()}`;
      const response = await fetch(fetchUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
      if (!response.ok) throw new Error(`伺服器回應錯誤 (Status: ${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('資料格式錯誤');
      
      setDatabase(prev => ({ ...prev, [examId]: data }));
      
      const uniqueClasses = [...new Set(data.map(d => String(d.class)))].sort();
      if (uniqueClasses.length > 0) setClasses(uniqueClasses);

      setSuccessMsg(`成功讀取！共 ${data.length} 筆資料`);
    } catch (err) {
      console.error('Data Fetch Error:', err);
      let userTip = '';
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        userTip = ' (請檢查 Apps Script 權限是否為「任何人」)';
      }
      setErrorMsg(`抓取失敗: ${err.message}${userTip}`);
    } finally {
      setIsLoading(false);
    }
  }, [googleScriptUrl]); // 依賴 googleScriptUrl

  const handleConnect = () => {
    const url = googleScriptUrl.trim();
    if (url && url.includes('script.google.com')) fetchSettings(url);
  };

  // 監聽：切換考試時自動抓取 (Live Mode)
  useEffect(() => {
    // 將 currentExam 放入依賴，並在內部檢查條件
    if (isLiveMode && googleScriptUrl && !isLoading) {
      const hasData = database[currentExam] && database[currentExam].length > 0;
      if (!hasData) {
        fetchLiveData(currentExam);
      }
    }
  }, [currentExam, isLiveMode, googleScriptUrl, isLoading, database, fetchLiveData]);

  // 初始化模擬資料
  useEffect(() => {
    if (isLiveMode) return;
    setDatabase(prevDb => {
      const newDb = { ...prevDb };
      exams.forEach(exam => {
        if (!newDb[exam.id]) newDb[exam.id] = []; 
        classes.forEach(cls => {
          const hasClassData = newDb[exam.id].some(s => s.class === cls);
          if (!hasClassData) {
            const newStudents = generateClassData(cls, exam.id);
            newDb[exam.id] = [...newDb[exam.id], ...newStudents];
          }
        });
      });
      return newDb;
    });
  }, [exams, classes, isLiveMode]);

  // --- 運算邏輯 ---
  const currentData = useMemo(() => database[currentExam] || [], [database, currentExam]);
  const processedData = useMemo(() => currentData.map(processGrades), [currentData]);

  // 校排資料
  const sortedData = useMemo(() => {
    const sorted = [...processedData].sort((a, b) => b.total - a.total);
    let rank = 1;
    return sorted.map((s, i) => {
      if (i > 0 && s.total < sorted[i-1].total) rank = i + 1;
      return { ...s, schoolRank: rank };
    });
  }, [processedData]);

  // 顯示資料 (校排/班排)
  const displayData = useMemo(() => {
    let data = [...sortedData];
    if (viewMode === 'class') {
       data = data.sort((a, b) => {
         const classA = String(a.class || '');
         const classB = String(b.class || '');
         if (classA !== classB) return classA.localeCompare(classB, undefined, { numeric: true });
         return b.total - a.total;
       });
    }
    return data;
  }, [sortedData, viewMode]);

  // 班級平均分析邏輯
  const classAnalysisData = useMemo(() => {
    const groups = {};
    processedData.forEach(student => {
      const cls = student.class;
      if (!groups[cls]) {
        groups[cls] = { 
          count: 0, 
          chi: 0, eng: 0, math: 0, sci: 0, 
          geo: 0, hist: 0, civ: 0, 
          social: 0, total: 0 
        };
      }
      const g = groups[cls];
      g.count += 1;
      g.chi += Number(student.chi) || 0;
      g.eng += Number(student.eng) || 0;
      g.math += Number(student.math) || 0;
      g.sci += Number(student.sci) || 0;
      g.geo += Number(student.geo) || 0;
      g.hist += Number(student.hist) || 0;
      g.civ += Number(student.civ) || 0;
      g.social += student.social;
      g.total += student.total;
    });

    return Object.keys(groups).sort((a, b) => {
       return String(a).localeCompare(String(b), undefined, { numeric: true });
    }).map(cls => {
      const g = groups[cls];
      const avg = (sum) => (sum / g.count).toFixed(1);
      return {
        class: cls,
        count: g.count,
        chi: avg(g.chi),
        eng: avg(g.eng),
        math: avg(g.math),
        sci: avg(g.sci),
        geo: avg(g.geo),
        hist: avg(g.hist),
        civ: avg(g.civ),
        social: avg(g.social),
        total: avg(g.total)
      };
    });
  }, [processedData]);

  // 模擬動作
  const handleAddClass = () => {
    if (isLiveMode) return; 
    const nextClassNum = parseInt(classes[classes.length - 1] || '700') + 1;
    setClasses([...classes, `${nextClassNum}`]);
  };
  const handleAddExam = () => {
    if (isLiveMode) return;
    const nextExamNum = exams.length + 1;
    const newExamId = `Exam${nextExamNum}`;
    setExams([...exams, { id: newExamId, label: `112上-第${nextExamNum}次段考` }]);
    setCurrentExam(newExamId);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-10">
      {/* 導覽列 */}
      <nav className="bg-slate-800 text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span className="font-bold text-lg hidden md:inline">校務成績中心</span>
            <span className="font-bold text-lg md:hidden">成績中心</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors border ${
                showAdminPanel ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
              }`}
            >
              <Settings className="w-3 h-3" />
              {showAdminPanel ? '設定' : '設定'}
            </button>
            <div className="relative group">
              <select
                value={currentExam}
                onChange={(e) => setCurrentExam(e.target.value)}
                className="appearance-none bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 pl-4 pr-10 rounded text-sm font-medium cursor-pointer focus:outline-none transition-colors"
              >
                {exams.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-2 pointer-events-none text-emerald-200" />
            </div>
            {isLiveMode && (
              <button 
                onClick={() => fetchLiveData(currentExam)}
                disabled={isLoading}
                className="p-1.5 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400"
                title="重新抓取成績"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* --- 控制面板 --- */}
      {showAdminPanel && (
        <div className="bg-white border-b-4 border-emerald-500 mb-6 shadow-sm animate-in slide-in-from-top-4 duration-500">
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-3">
                 <h3 className="font-bold text-blue-900 flex items-center gap-2">
                   <Link className="w-5 h-5" />
                   Google Sheets 連線設定
                 </h3>
                 <div className="flex items-center gap-2">
                   <span className={`text-xs px-2 py-1 rounded font-bold ${isLiveMode ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                     {isLiveMode ? '● 連線模式' : '○ 模擬模式'}
                   </span>
                   <button onClick={() => setIsLiveMode(!isLiveMode)} className="text-xs text-blue-600 underline">
                     {isLiveMode ? '切換回模擬資料' : '切換至真實資料'}
                   </button>
                 </div>
              </div>
              
              {isLiveMode ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-blue-700">Apps Script Web App URL</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      value={googleScriptUrl}
                      onChange={(e) => setGoogleScriptUrl(e.target.value)}
                      placeholder="請貼上您的 https://script.google.com/.../exec 網址"
                      className="flex-grow px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button 
                      onClick={handleConnect}
                      disabled={isConfigLoading || !googleScriptUrl}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {isConfigLoading ? '讀取設定...' : '連線並同步設定'}
                    </button>
                  </div>
                  {errorMsg && (
                    <div className="flex items-center gap-2 text-red-600 text-sm mt-2 bg-red-50 p-2 rounded animate-pulse">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="flex items-center gap-2 text-green-700 text-sm mt-2 bg-green-50 p-2 rounded">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-blue-800">目前使用<b>亂數模擬資料</b>。若要連結真實 Google Sheets，請點擊上方切換按鈕。</p>
              )}
            </div>
            
            {!isLiveMode && (
              <div className="flex flex-col md:flex-row gap-8 pt-4 border-t border-slate-100">
                <div className="md:w-1/3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-500" />
                    模擬操作
                  </h3>
                </div>
                <div className="md:w-2/3 flex flex-wrap gap-6 items-center">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex-1">
                    <button onClick={handleAddClass} className="w-full py-2 bg-white border-2 border-dashed border-slate-300 text-slate-500 rounded hover:border-emerald-500 hover:text-emerald-600 transition-all text-sm font-medium flex items-center justify-center gap-2">
                      <PlusCircle className="w-4 h-4" /> 模擬新增一班
                    </button>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex-1">
                    <button onClick={handleAddExam} className="w-full py-2 bg-white border-2 border-dashed border-slate-300 text-slate-500 rounded hover:border-blue-500 hover:text-blue-600 transition-all text-sm font-medium flex items-center justify-center gap-2">
                      <PlusCircle className="w-4 h-4" /> 模擬新增段考
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 主要內容區 */}
      <main className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-end mb-4 gap-2">
           <div>
             <h2 className="text-2xl font-bold text-slate-800">
               {exams.find(e => e.id === currentExam)?.label || currentExam} 成績總表
             </h2>
             {isLiveMode && (
               <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2">即時資料</span>
             )}
           </div>
           <div className="text-sm text-slate-500">
             目前顯示: {classes.length} 個班級，共 {sortedData.length} 位學生
           </div>
        </div>

        {/* 頁籤切換 (Tab) */}
        <div className="flex gap-2 mb-4 border-b border-slate-200">
           <button 
             onClick={() => setViewMode('school')}
             className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
               viewMode === 'school' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
             }`}
           >
             <Trophy className="w-4 h-4" /> 全校總榜
           </button>
           <button 
             onClick={() => setViewMode('class')}
             className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
               viewMode === 'class' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
             }`}
           >
             <Users className="w-4 h-4" /> 班級成績單
           </button>
           <button 
             onClick={() => setViewMode('analysis')}
             className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
               viewMode === 'analysis' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'
             }`}
           >
             <BarChart3 className="w-4 h-4" /> 班級分析 (平均)
           </button>
        </div>

        {/* 表格區 */}
        {isLoading ? (
          <div className="bg-white p-12 text-center rounded-xl shadow border border-slate-200">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">正在從 Google Sheets 讀取各班資料...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl shadow border border-dashed border-slate-300">
            <p className="text-slate-400">目前沒有資料。{isLiveMode && '請確認您的試算表分頁名稱是否正確'}</p>
          </div>
        ) : viewMode === 'analysis' ? (
          /* --- 班級分析表格 (新功能) --- */
          <div className="bg-white shadow rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-100">
                <tr>
                  <th className="px-4 py-3">班級</th>
                  <th className="px-4 py-3 text-right">人數</th>
                  <th className="px-4 py-3 text-right">國文(均)</th>
                  <th className="px-4 py-3 text-right">英語(均)</th>
                  <th className="px-4 py-3 text-right">數學(均)</th>
                  <th className="px-4 py-3 text-right">自然(均)</th>
                  <th className="px-4 py-3 text-right">地理(均)</th>
                  <th className="px-4 py-3 text-right">歷史(均)</th>
                  <th className="px-4 py-3 text-right">公民(均)</th>
                  <th className="px-4 py-3 text-right bg-purple-100/50">社會科(均)</th>
                  <th className="px-4 py-3 text-right bg-slate-100 text-slate-800">總分(均)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classAnalysisData.map((cls) => {
                  const rowBg = getClassColor(cls.class);
                  return (
                    <tr key={cls.class} className={`${rowBg} hover:brightness-95 transition-all`}>
                      <td className="px-4 py-3 font-bold text-slate-700">{cls.class} 班</td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.chi}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.eng}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.math}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.sci}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.geo}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.hist}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.civ}</td>
                      <td className="px-4 py-3 text-right font-bold text-purple-600 bg-purple-50/20">{cls.social}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-800 bg-slate-50">{cls.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="p-4 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
              * 此表顯示各班級的平均分數 (總分加總 ÷ 該班人數)。
            </div>
          </div>
        ) : (
          /* --- 原有的總榜/班級列表 --- */
          <div className="bg-white shadow rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center w-16">{viewMode === 'school' ? '全校排名' : '班級排名'}</th>
                  <th className="px-4 py-3">班級</th>
                  <th className="px-4 py-3">姓名</th>
                  <th className="px-4 py-3 text-right">總分</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">國文</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">英文</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">數學</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">自然</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell text-blue-600">社會(均)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayData.map((student, idx) => {
                  const rank = viewMode === 'school' ? student.schoolRank : (idx + 1); // 簡化班排顯示
                  const rowBg = getClassColor(student.class);
                  return (
                    <tr key={`${student.class}-${student.seat}`} className={`${rowBg} hover:brightness-95 transition-all`}>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-white/50 text-slate-500'
                        }`}>
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{student.class}</td>
                      <td className="px-4 py-3 text-slate-600">{student.name}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-800">{student.total}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{student.chi}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{student.eng}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{student.math}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{student.sci}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-bold hidden sm:table-cell">{student.social}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}