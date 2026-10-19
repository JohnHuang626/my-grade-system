"use client";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Trophy, Users, BookOpen, ChevronDown, Search, PlusCircle, Settings, Link, RefreshCw, AlertCircle, CheckCircle2, BarChart3, Printer, Filter, ExternalLink, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// --- 設定：班級專屬背景色票 ---
const CLASS_BG_COLORS = [
  'bg-blue-100',   // 尾數 1, 6
  'bg-yellow-100', // 尾數 2, 7
  'bg-green-100',  // 尾數 3, 8
  'bg-gray-100',   // 尾數 4, 9
  'bg-orange-100'  // 尾數 5, 0
];

const getClassColor = (className) => {
  if (!className) return 'bg-white';
  const num = parseInt(String(className).replace(/\D/g, ''), 10);
  if (isNaN(num)) return 'bg-white';
  const mod = num % 5;
  const index = mod === 0 ? 4 : mod - 1;
  return CLASS_BG_COLORS[index];
};

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
  const [googleScriptUrl, setGoogleScriptUrl] = useState('https://script.google.com/macros/s/AKfycbx4qB7LEhkOnPJZ9dvuR9TGzKlI4OL6-zVcCi_Bgzw5fxBGKd1D6kdJW1qheB0Ghiqi/exec');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [exams, setExams] = useState([]);
  const [currentExam, setCurrentExam] = useState(''); 
  const [classes, setClasses] = useState([]); // 這裡將儲存 { name, id } 物件

  const [database, setDatabase] = useState({});
  const [viewMode, setViewMode] = useState('school'); 
  const [selectedClass, setSelectedClass] = useState('All'); 
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  const handlePrint = () => window.print();

  const handleToggleSettings = () => {
    if (showAdminPanel) {
      setShowAdminPanel(false);
      setErrorMsg(''); setSuccessMsg('');
    } else {
      setShowPasswordModal(true);
      setPasswordInput('');
      setPasswordError('');
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === "888") {
      setShowAdminPanel(true);
      setShowPasswordModal(false);
    } else {
      setPasswordError("密碼錯誤，請重新輸入！");
    }
  };

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
        setCurrentExam(prev => {
           const currentExists = data.exams.some(e => e.id === prev);
           if (currentExists && prev) return prev;
           return data.exams[data.exams.length - 1].id;
        });
      }
      
      // [修正] 處理班級資料，支援新版 API 回傳的 {name, id} 格式
      if (data.classes && data.classes.length > 0) {
        const formattedClasses = data.classes.map(c => {
          // 如果後端只回傳字串 (舊版)，就沒有 ID
          if (typeof c === 'string' || typeof c === 'number') {
            return { name: String(c), id: null };
          }
          // 如果後端回傳物件 (新版)，則包含 ID
          return { name: String(c.name), id: c.id };
        });
        setClasses(formattedClasses);
      }

      // 智慧定位最新考試 (略過...)
      if (data.exams && data.exams.length > 0) {
        setSuccessMsg('已連線，正在搜尋最新考試記錄...');
        const checkData = async (id) => {
           try {
             const r = await fetch(`${url}${url.includes('?')?'&':'?'}exam=${id}&t=${Date.now()}`, {method: 'GET', mode: 'cors', redirect:'follow'});
             const j = await r.json();
             if (Array.isArray(j) && j.length > 0) {
               const hasRealScores = j.some(student => {
                 const subjects = ['chi', 'eng', 'math', 'sci', 'geo', 'hist', 'civ'];
                 return subjects.some(sub => student[sub] !== "" && student[sub] !== undefined && student[sub] !== null);
               });
               if (hasRealScores) {
                 setDatabase(prev => ({ ...prev, [id]: j }));
                 return true;
               }
             }
             return false;
           } catch { return false; }
        };

        let low = 0, high = data.exams.length - 1, bestIndex = 0;
        const lastHasData = await checkData(data.exams[high].id);
        if (lastHasData) bestIndex = high;
        else {
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (await checkData(data.exams[mid].id)) {
              bestIndex = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
        }
        setCurrentExam(data.exams[bestIndex].id);
        setSuccessMsg(`已連線！自動切換至：${data.exams[bestIndex].label}`);
      }
    } catch (err) {
      console.error('Config Fetch Error:', err);
    } finally {
      setIsConfigLoading(false);
    }
  }, []); 

  const fetchLiveData = useCallback(async (examId, isBackground = false) => {
    const targetUrlRaw = googleScriptUrl.trim();
    if (!targetUrlRaw || !examId) return;
    if (targetUrlRaw.includes('/edit')) { if (!isBackground) setErrorMsg('網址錯誤'); return; }

    if (!isBackground) {
      setIsLoading(true);
      setErrorMsg(''); setSuccessMsg('');
    }
    
    try {
      const fetchUrl = `${targetUrlRaw}${targetUrlRaw.includes('?') ? '&' : '?'}exam=${examId}&t=${new Date().getTime()}`;
      const response = await fetch(fetchUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Format Error');
      
      setDatabase(prev => ({ ...prev, [examId]: data }));
      
      if (!isBackground) {
        // 更新班級列表 (如果設定檔沒抓到，這裡做 fallback)
        const uniqueClassNames = [...new Set(data.map(d => String(d.class)))].sort();
        setClasses(prev => {
          // 如果目前沒班級資料，或是現有資料沒有 ID，嘗試合併
          if (prev.length === 0) return uniqueClassNames.map(name => ({ name, id: null }));
          return prev;
        });

        setSuccessMsg(`成功讀取！共 ${data.length} 筆資料`);
      }
    } catch (err) {
      console.error(err);
      if (!isBackground) setErrorMsg(`抓取失敗: ${err.message}`);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [googleScriptUrl]); 

  const handleConnect = () => {
    const url = googleScriptUrl.trim();
    if (url && url.includes('script.google.com')) fetchSettings(url);
  };

  useEffect(() => {
    if (googleScriptUrl && !isLoading && currentExam) {
      const hasData = database[currentExam] && database[currentExam].length > 0;
      if (!hasData) fetchLiveData(currentExam);
    }
  }, [currentExam, googleScriptUrl, isLoading, database, fetchLiveData]);

  // 自動在背景抓取「上一次考試」的資料，用來計算名次進退步
  const prevExamId = useMemo(() => {
    if (!currentExam || exams.length === 0) return null;
    const idx = exams.findIndex(e => e.id === currentExam);
    if (idx > 0) return exams[idx - 1].id;
    return null;
  }, [currentExam, exams]);

  useEffect(() => {
    if (googleScriptUrl && prevExamId) {
      const hasPrevData = database[prevExamId] && database[prevExamId].length > 0;
      if (!hasPrevData) {
        fetchLiveData(prevExamId, true);
      }
    }
  }, [prevExamId, googleScriptUrl, database, fetchLiveData]);

  useEffect(() => {
    if (googleScriptUrl) fetchSettings(googleScriptUrl);
  }, [fetchSettings, googleScriptUrl]);

  useEffect(() => {
    if (viewMode === 'school') setSelectedClass('All');
    setSortConfig({ key: null, direction: 'desc' });
  }, [viewMode]);

  // 點擊表頭排序處理函數
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      // 科目與總分預設「由高到低(desc)」，排名、班級(座號)、姓名預設「由小到大(asc)」
      const defaultAscKeys = ['classSeat', 'schoolRank', 'classRank', 'name'];
      return { key, direction: defaultAscKeys.includes(key) ? 'asc' : 'desc' };
    });
  };

  // 渲染排序圖示
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 inline-block ml-1 text-slate-300 opacity-70 group-hover:opacity-100 print:hidden" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 inline-block ml-1 text-blue-600 print:hidden" />
      : <ArrowDown className="w-3.5 h-3.5 inline-block ml-1 text-blue-600 print:hidden" />;
  };

  // 輔助：將班級與座號格式化為 2(01)
  const formatClassSeat = (cls, seat) => {
    if (seat === undefined || seat === null || seat === '') return String(cls || '');
    const seatNum = parseInt(seat, 10);
    const formattedSeat = !isNaN(seatNum) ? String(seatNum).padStart(2, '0') : String(seat);
    return `${cls}(${formattedSeat})`;
  };

  // --- 運算邏輯 ---
  const currentData = useMemo(() => database[currentExam] || [], [database, currentExam]);
  const processedData = useMemo(() => currentData.map(processGrades), [currentData]);

  // 計算上一次考試的全校排名對照表
  const prevRankMap = useMemo(() => {
    if (!prevExamId || !database[prevExamId]) return null;
    const prevRaw = database[prevExamId];
    if (!Array.isArray(prevRaw) || prevRaw.length === 0) return null;

    // 確認上次考試有實際分數才納入比較
    const hasScores = prevRaw.some(student => {
      const subjects = ['chi', 'eng', 'math', 'sci', 'geo', 'hist', 'civ'];
      return subjects.some(sub => student[sub] !== "" && student[sub] !== undefined && student[sub] !== null);
    });
    if (!hasScores) return null;

    const prevProcessed = prevRaw.map(processGrades);
    const prevSorted = [...prevProcessed].sort((a, b) => b.total - a.total);
    
    const map = {};
    let rank = 1;
    prevSorted.forEach((s, i) => {
      if (i > 0 && s.total < prevSorted[i - 1].total) rank = i + 1;
      // 使用「班級-座號」作為唯一識別碼，並保留「班級-姓名」作為備用對照
      const keySeat = `${s.class}-${s.seat}`;
      const keyName = `${s.class}-${s.name}`;
      map[keySeat] = rank;
      if (s.name) map[keyName] = rank;
    });
    return map;
  }, [prevExamId, database]);

  const availableClasses = useMemo(() => {
    const clsSet = new Set(processedData.map(s => String(s.class)));
    return ['All', ...Array.from(clsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [processedData]);

  const sortedData = useMemo(() => {
    const sorted = [...processedData].sort((a, b) => b.total - a.total);
    let rank = 1;
    return sorted.map((s, i) => {
      if (i > 0 && s.total < sorted[i-1].total) rank = i + 1;
      
      let rankChange = null;
      let prevSchoolRank = null;
      if (prevRankMap) {
        const keySeat = `${s.class}-${s.seat}`;
        const keyName = `${s.class}-${s.name}`;
        prevSchoolRank = prevRankMap[keySeat] ?? prevRankMap[keyName] ?? null;
        if (prevSchoolRank !== null) {
          // 上次名次 減 本次名次：正數代表進步(名次數字變小)，負數代表退步
          rankChange = prevSchoolRank - rank;
        }
      }

      return { ...s, schoolRank: rank, prevSchoolRank, rankChange };
    });
  }, [processedData, prevRankMap]);

  const displayData = useMemo(() => {
    let data = [...sortedData];
    if (viewMode === 'class' && selectedClass !== 'All') {
      data = data.filter(s => String(s.class) === selectedClass);
    }
    if (viewMode === 'class') {
       data = data.sort((a, b) => {
         const classA = String(a.class || '');
         const classB = String(b.class || '');
         if (classA !== classB) return classA.localeCompare(classB, undefined, { numeric: true });
         return b.total - a.total;
       });

       // 計算各班級內部的正確排名 (處理同分同名次，且切換班級時重新從 1 開始計算)
       let currentClass = null;
       let currentRank = 1;
       let classStudentIndex = 0;

       data = data.map((s, idx) => {
         if (s.class !== currentClass) {
           currentClass = s.class;
           classStudentIndex = 0;
           currentRank = 1;
         } else {
           classStudentIndex++;
           if (s.total < data[idx - 1].total) {
             currentRank = classStudentIndex + 1;
           }
         }
         return { ...s, classRank: currentRank };
       });
    }

    // 若使用者點擊了表頭欄位，進行自訂排序 (不影響已算好的班排與校排數字)
    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      const dir = direction === 'asc' ? 1 : -1;

      data = [...data].sort((a, b) => {
        if (key === 'classSeat') {
          const classA = String(a.class || '');
          const classB = String(b.class || '');
          const clsCmp = classA.localeCompare(classB, undefined, { numeric: true });
          if (clsCmp !== 0) return clsCmp * dir;
          const seatA = Number(a.seat) || 0;
          const seatB = Number(b.seat) || 0;
          return (seatA - seatB) * dir;
        }
        if (key === 'name') {
          return String(a.name || '').localeCompare(String(b.name || ''), 'zh-TW') * dir;
        }
        const valA = Number(a[key]) || 0;
        const valB = Number(b[key]) || 0;
        if (valA !== valB) return (valA - valB) * dir;
        // 同分時，預設以班級與座號小到大排列
        const classA = String(a.class || '');
        const classB = String(b.class || '');
        const clsCmp = classA.localeCompare(classB, undefined, { numeric: true });
        if (clsCmp !== 0) return clsCmp;
        return (Number(a.seat) || 0) - (Number(b.seat) || 0);
      });
    }

    return data;
  }, [sortedData, viewMode, selectedClass, sortConfig]);

  const classAnalysisData = useMemo(() => {
    const groups = {};
    processedData.forEach(student => {
      const cls = student.class;
      if (!groups[cls]) {
        groups[cls] = { count: 0, chi: 0, eng: 0, math: 0, sci: 0, geo: 0, hist: 0, civ: 0, social: 0, total: 0 };
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

    const baseList = Object.keys(groups).sort((a, b) => {
       return String(a).localeCompare(String(b), undefined, { numeric: true });
    }).map(cls => {
      const g = groups[cls];
      const avg = (sum) => (sum / g.count).toFixed(1);
      return {
        class: cls, count: g.count,
        chi: avg(g.chi), eng: avg(g.eng), math: avg(g.math), sci: avg(g.sci),
        geo: avg(g.geo), hist: avg(g.hist), civ: avg(g.civ),
        social: avg(g.social), total: avg(g.total)
      };
    });

    // 計算各科與總分在年級中的班級排名 (處理同分同名次)
    const subjects = ['chi', 'eng', 'math', 'sci', 'geo', 'hist', 'civ', 'social', 'total'];
    const ranks = {};
    
    subjects.forEach(sub => {
      const sorted = [...baseList].sort((a, b) => parseFloat(b[sub]) - parseFloat(a[sub]));
      ranks[sub] = {};
      let currentRank = 1;
      sorted.forEach((item, index) => {
        if (index > 0 && parseFloat(item[sub]) < parseFloat(sorted[index - 1][sub])) {
          currentRank = index + 1;
        }
        ranks[sub][item.class] = currentRank;
      });
    });

    return baseList.map(item => {
      const itemWithRanks = { ...item };
      subjects.forEach(sub => {
        itemWithRanks[`${sub}Rank`] = ranks[sub][item.class];
      });
      return itemWithRanks;
    });
  }, [processedData]);

  const filteredAnalysisData = useMemo(() => {
    if (selectedClass === 'All') return classAnalysisData;
    return classAnalysisData.filter(d => String(d.class) === selectedClass);
  }, [classAnalysisData, selectedClass]);

  const schoolAverageStats = useMemo(() => {
    if (processedData.length === 0) return null;
    const totals = { count: 0, chi: 0, eng: 0, math: 0, sci: 0, geo: 0, hist: 0, civ: 0, social: 0, total: 0 };
    processedData.forEach(student => {
      totals.count += 1;
      totals.chi += Number(student.chi) || 0;
      totals.eng += Number(student.eng) || 0;
      totals.math += Number(student.math) || 0;
      totals.sci += Number(student.sci) || 0;
      totals.geo += Number(student.geo) || 0;
      totals.hist += Number(student.hist) || 0;
      totals.civ += Number(student.civ) || 0;
      totals.social += student.social;
      totals.total += student.total;
    });
    const avg = (sum) => (sum / totals.count).toFixed(1);
    return {
      count: totals.count,
      chi: avg(totals.chi), eng: avg(totals.eng), math: avg(totals.math), sci: avg(totals.sci),
      geo: avg(totals.geo), hist: avg(totals.hist), civ: avg(totals.civ),
      social: avg(totals.social), total: avg(totals.total)
    };
  }, [processedData]);

  // 新增：當在「班級分析」選擇特定班級時，計算該班七科的組距分布、班高標(前標P75)、班低標(後標P25)、標準差與雷達圖數據
  const detailedClassStats = useMemo(() => {
    if (viewMode !== 'analysis' || selectedClass === 'All' || !schoolAverageStats) return null;
    
    const classStudents = processedData.filter(s => String(s.class) === selectedClass);
    if (classStudents.length === 0) return null;

    const subjects = [
      { key: 'chi', label: '國文' },
      { key: 'eng', label: '英語' },
      { key: 'math', label: '數學' },
      { key: 'sci', label: '自然' },
      { key: 'geo', label: '地理' },
      { key: 'hist', label: '歷史' },
      { key: 'civ', label: '公民' }
    ];

    const ranges = [
      { label: '90~100', min: 90, max: 100 },
      { label: '80~89', min: 80, max: 89.99 },
      { label: '70~79', min: 70, max: 79.99 },
      { label: '60~69', min: 60, max: 69.99 },
      { label: '50~59', min: 50, max: 59.99 },
      { label: '40~49', min: 40, max: 49.99 },
      { label: '0~39', min: 0, max: 39.99 },
    ];

    // 計算百分位數 (用於高標 P75 與低標 P25)
    const getPercentile = (sortedAsc, p) => {
      if (sortedAsc.length === 0) return 0;
      const index = (sortedAsc.length - 1) * p;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sortedAsc[lower] * (1 - weight) + sortedAsc[upper] * weight;
    };

    const statsBySubject = {};

    subjects.forEach(({ key, label }) => {
      const scores = classStudents.map(s => Number(s[key]) || 0);
      const sortedAsc = [...scores].sort((a, b) => a - b);
      const n = scores.length;

      // 平均值
      const mean = n > 0 ? scores.reduce((a, b) => a + b, 0) / n : 0;

      // 標準差 (Standard Deviation)
      const variance = n > 0 ? scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n : 0;
      const stdDev = Math.sqrt(variance);

      // 班高標 (前標 75th percentile) & 班低標 (後標 25th percentile)
      const highMark = getPercentile(sortedAsc, 0.75);
      const lowMark = getPercentile(sortedAsc, 0.25);

      // 各組距人數統計
      const counts = {};
      let maxCount = 0;
      ranges.forEach(r => {
        let count = 0;
        if (r.label === '90~100') {
          count = scores.filter(val => val >= 90).length;
        } else if (r.label === '0~39') {
          count = scores.filter(val => val < 40).length;
        } else {
          const base = parseInt(r.label.split('~')[0], 10);
          count = scores.filter(val => val >= base && val < base + 10).length;
        }
        counts[r.label] = count;
        if (count > maxCount) maxCount = count;
      });

      const schoolAvg = Number(schoolAverageStats[key]) || 0;
      const ratio = schoolAvg > 0 ? ((mean / schoolAvg) * 100).toFixed(1) : '100.0';
      const diff = (mean - schoolAvg).toFixed(1);

      statsBySubject[key] = {
        label,
        counts,
        maxCount,
        mean: mean.toFixed(2),
        highMark: highMark.toFixed(2),
        lowMark: lowMark.toFixed(2),
        stdDev: stdDev.toFixed(2),
        schoolAvg: schoolAvg.toFixed(2),
        meanNum: mean,
        schoolAvgNum: schoolAvg,
        ratio,
        diff: Number(diff) > 0 ? `+${diff}` : diff
      };
    });

    return { subjects, ranges, statsBySubject, studentCount: classStudents.length };
  }, [viewMode, selectedClass, processedData, schoolAverageStats]);

  // 輔助：顯示進退步標記 (↑進步 / ↓退步 / -持平)
  const renderRankChange = (change, prevRank) => {
    if (change === null || change === undefined) return null;
    if (change > 0) {
      return (
        <span className="text-[11px] font-bold text-emerald-600 ml-1 inline-block print:text-black" title={`上次全校第 ${prevRank} 名 (進步 ${change} 名)`}>
          ↑{change}
        </span>
      );
    }
    if (change < 0) {
      return (
        <span className="text-[11px] font-bold text-rose-500 ml-1 inline-block print:text-black" title={`上次全校第 ${prevRank} 名 (退步 ${Math.abs(change)} 名)`}>
          ↓{Math.abs(change)}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-normal text-slate-400 ml-1 inline-block print:text-black" title={`上次全校第 ${prevRank} 名 (名次持平)`}>
        -
      </span>
    );
  };

  const getPrintTitle = () => {
    const examName = exams.find(e => e.id === currentExam)?.label || currentExam || '...';
    let typeName = '';
    if (viewMode === 'school') typeName = '全校總榜';
    else if (viewMode === 'class') typeName = selectedClass !== 'All' ? `${selectedClass}班 成績單` : '班級成績單 (全校)';
    else if (viewMode === 'analysis') typeName = selectedClass !== 'All' ? `${selectedClass}班 與年級平均比較表` : '各班平均分析表';
    return `${examName} - ${typeName}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-10 print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { size: ${viewMode === 'analysis' ? 'A4 portrait' : 'A3 portrait'}; margin: 8mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: white !important; }
          .no-print { display: none !important; }
          .table-container { box-shadow: none !important; border: 1px solid #ddd !important; overflow: visible !important; max-height: none !important; width: 100% !important; }
          .print-header { display: block !important; text-align: center; margin-bottom: 12px; }
          .print-header h1 { font-size: 20px; font-weight: bold; }
          .print-header p { font-size: 12px; color: #666; }
          /* 縮減列印時的內距與字體大小，確保 13 個欄位能完整塞進同一頁不超出邊界 */
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { padding: 5px 4px !important; font-size: 12px !important; white-space: nowrap !important; }
        }
        .print-header { display: none; }
      `}</style>

      {/* 導覽列 */}
      <nav className="bg-slate-800 text-white sticky top-0 z-20 shadow-lg no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span className="font-bold text-lg hidden md:inline">年級成績中心</span>
            <span className="font-bold text-lg md:hidden">成績中心</span>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handlePrint} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white" title="列印報表">
              <Printer className="w-3 h-3" /> 列印
            </button>
            <button onClick={handleToggleSettings} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border ${showAdminPanel ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
              <Settings className="w-3 h-3" /> {showAdminPanel ? '設定' : '管理員'}
            </button>
            <div className="relative group">
              <select value={currentExam} onChange={(e) => setCurrentExam(e.target.value)} className="appearance-none bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 pl-4 pr-10 rounded text-sm font-medium cursor-pointer">
                {exams.length > 0 ? exams.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>) : <option>載入中...</option>}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-2 pointer-events-none text-emerald-200" />
            </div>
            {googleScriptUrl && (
              <button onClick={() => fetchLiveData(currentExam)} disabled={isLoading || !currentExam} className="p-1.5 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 控制面板 */}
      {showAdminPanel && (
        <div className="bg-white border-b-4 border-emerald-500 mb-6 shadow-sm animate-in slide-in-from-top-4 duration-500 no-print">
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-3">
                 <h3 className="font-bold text-blue-900 flex items-center gap-2"><Link className="w-5 h-5" /> Google Sheets 連線設定</h3>
                 <div className="text-xs text-blue-500">* 請在此輸入 Apps Script 部署網址以連結資料庫</div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-blue-700">Apps Script Web App URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" value={googleScriptUrl} onChange={(e) => setGoogleScriptUrl(e.target.value)} placeholder="請貼上您的 exec 網址" className="flex-grow px-3 py-2 text-sm border border-blue-200 rounded" />
                  <button onClick={handleConnect} disabled={isConfigLoading || !googleScriptUrl} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">{isConfigLoading ? '讀取設定...' : '連線並同步設定'}</button>
                </div>
                {errorMsg && <div className="flex items-center gap-2 text-red-600 text-sm mt-2 bg-red-50 p-2 rounded animate-pulse"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMsg}</span></div>}
                {successMsg && <div className="flex items-center gap-2 text-green-700 text-sm mt-2 bg-green-50 p-2 rounded"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>{successMsg}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 列印標題 */}
      <div className="print-header">
        <h1>{getPrintTitle()}</h1>
        <p>列印日期：{new Date().toLocaleDateString()}</p>
      </div>

      {/* 密碼輸入視窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">請輸入管理員密碼</h3>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="輸入密碼..."
                autoFocus
              />
              {passwordError && <p className="text-red-500 text-xs mb-3">{passwordError}</p>}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  確認
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 提示訊息視窗 */}
      {toastMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-2 text-amber-600 font-bold mb-2">
              <AlertCircle className="w-5 h-5" />
              <span>提示</span>
            </div>
            <p className="text-slate-600 text-sm whitespace-pre-line mb-4">{toastMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setToastMessage('')}
                className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 print:max-w-none print:px-0 pt-6">
        
        {/* === 新增區塊：各班成績輸入入口 (Quick Links) === */}
        <div className="mb-6 no-print">
          <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            各班成績輸入 (導師專用)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {classes.length > 0 ? (
              classes.map((cls) => (
                <a
                  key={cls.name}
                  href={cls.id ? `https://docs.google.com/spreadsheets/d/${cls.id}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!cls.id) {
                      e.preventDefault();
                      setToastMessage(`尚未設定 ${cls.name} 班的試算表連結。\n請確認 Master Sheet 中的 ID 欄位是否正確，並更新 Google Apps Script。`);
                    }
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md group ${
                    cls.id 
                      ? 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700' 
                      : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span className="font-bold">{cls.name} 班</span>
                  <ExternalLink className={`w-4 h-4 ${cls.id ? 'text-slate-400 group-hover:text-emerald-500' : 'text-slate-300'}`} />
                </a>
              ))
            ) : (
              <div className="col-span-full text-center py-4 text-slate-400 text-sm bg-white rounded border border-dashed">
                連線後將自動載入班級連結...
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-end mb-4 gap-2 no-print">
           <div>
             <h2 className="text-2xl font-bold text-slate-800">
               {exams.find(e => e.id === currentExam)?.label || currentExam || '...'} 成績總表
             </h2>
             <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2">即時資料系統</span>
           </div>
           <div className="text-sm text-slate-500">
             目前顯示: {classes.length} 個班級，共 {sortedData.length} 位學生
           </div>
        </div>

        {/* 頁籤切換 */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 no-print items-center">
           <button onClick={() => setViewMode('school')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${viewMode === 'school' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
             <Trophy className="w-4 h-4" /> 全校總榜 (A3)
           </button>
           <button onClick={() => setViewMode('class')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${viewMode === 'class' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
             <Users className="w-4 h-4" /> 班級成績單 (A3)
           </button>
           <button onClick={() => setViewMode('analysis')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${viewMode === 'analysis' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
             <BarChart3 className="w-4 h-4" /> 班級分析 (A4)
           </button>

           {(viewMode === 'class' || viewMode === 'analysis') && (
             <div className="ml-auto flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
               <div className="relative">
                 <Filter className="w-4 h-4 absolute left-3 top-2.5 text-emerald-600" />
                 <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="pl-9 pr-8 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none hover:bg-emerald-100 transition-colors">
                   <option value="All">顯示全部班級</option>
                   {availableClasses.map(cls => cls !== 'All' && <option key={cls} value={cls}>{cls} 班</option>)}
                 </select>
                 <ChevronDown className="w-4 h-4 absolute right-3 top-2.5 text-emerald-600 pointer-events-none" />
               </div>
             </div>
           )}
        </div>

        {/* 表格區 */}
        {isLoading ? (
          <div className="bg-white p-12 text-center rounded-xl shadow border border-slate-200 no-print">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">正在從 Google Sheets 讀取各班資料...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl shadow border border-dashed border-slate-300 no-print">
            <p className="text-slate-400">目前沒有資料。<br/>請確認管理員已設定 Google Apps Script 連線網址。</p>
          </div>
        ) : viewMode === 'analysis' ? (
          /* --- 班級分析表格與個別班級深度圖表 --- */
          <div>
          <div className="table-container bg-white shadow rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-black">
            <table className="w-full text-sm text-left">
              <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-100 print:bg-gray-100 print:text-black">
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
                  <th className="px-4 py-3 text-right bg-purple-100/50 print:bg-gray-200">社會(均)</th>
                  <th className="px-4 py-3 text-right bg-slate-100 text-slate-800 print:bg-gray-200">總分(均)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-gray-300">
                {filteredAnalysisData.map((cls) => {
                  const rowBg = getClassColor(cls.class);
                  return (
                    <tr key={cls.class} className={`${rowBg} hover:brightness-95 transition-all`}>
                      <td className="px-4 py-3 font-bold text-slate-700">{cls.class} 班</td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.chi}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.chiRank})</span></td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.eng}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.engRank})</span></td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.math}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.mathRank})</span></td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{cls.sci}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.sciRank})</span></td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.geo}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.geoRank})</span></td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.hist}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.histRank})</span></td>
                      <td className="px-4 py-3 text-right text-slate-500">{cls.civ}<span className="text-xs text-slate-400 font-normal ml-0.5 print:text-black">({cls.civRank})</span></td>
                      <td className="px-4 py-3 text-right font-bold text-purple-600 bg-purple-50/20 print:text-black">{cls.social}<span className="text-xs text-purple-400 font-normal ml-0.5 print:text-black">({cls.socialRank})</span></td>
                      <td className="px-4 py-3 text-right font-black text-slate-800 bg-slate-50">{cls.total}<span className="text-xs text-slate-500 font-normal ml-0.5 print:text-black">({cls.totalRank})</span></td>
                    </tr>
                  );
                })}
              </tbody>
              {schoolAverageStats && (
                <tfoot className="bg-slate-200 font-bold border-t-2 border-slate-300 print:bg-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-slate-800 print:text-black">全年級平均</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.count}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.chi}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.eng}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.math}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.sci}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.geo}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.hist}</td>
                    <td className="px-4 py-3 text-right text-slate-800 print:text-black">{schoolAverageStats.civ}</td>
                    <td className="px-4 py-3 text-right text-purple-800 bg-purple-100/50 print:bg-gray-200 print:text-black">{schoolAverageStats.social}</td>
                    <td className="px-4 py-3 text-right text-slate-900 bg-slate-200 print:bg-gray-200 print:text-black">{schoolAverageStats.total}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            <div className="p-4 text-xs text-slate-500 bg-slate-50 border-t border-slate-200 no-print">
              * 此表顯示各班級的平均分數 (總分加總 ÷ 該班人數)，括號內數字為該科在全年級各班中的排名。全年級平均為所有學生加總 ÷ 總人數。{selectedClass === 'All' && ' 請由右上方下拉選單選擇「特定班級」，即可檢視該班級距分布表、高低標、標準差與雷達圖分析！'}
            </div>
          </div>

          {/* === 當選取特定班級時，顯示組距統計表與七科雷達圖 === */}
          {detailedClassStats && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 print:grid-cols-12 print:gap-4 print:mt-4 print:break-inside-avoid">
              
              {/* 左側：各科組距人數、高低標與標準差統計表 */}
              <div className="lg:col-span-7 print:col-span-7 bg-white shadow rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-black">
                <div className="bg-slate-800 text-white px-4 py-2.5 font-bold text-sm flex justify-between items-center print:bg-gray-200 print:text-black print:border-b print:border-black">
                  <span>{selectedClass} 班 各科分數級距與五標統計表</span>
                  <span className="text-xs font-normal text-slate-300 print:text-gray-700">統計人數：{detailedClassStats.studentCount} 人</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-blue-50/80 text-slate-700 font-bold border-b border-slate-200 print:bg-gray-100 print:text-black">
                        <th className="py-2 px-2 border-r border-slate-200 print:border-gray-400">組距 / 統計</th>
                        {detailedClassStats.subjects.map(sub => (
                          <th key={sub.key} className="py-2 px-2 border-r border-slate-100 last:border-r-0 print:border-gray-400">{sub.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 print:divide-gray-400">
                      {/* 分數級距列 (90~100 至 0~39) */}
                      {detailedClassStats.ranges.map(range => (
                        <tr key={range.label} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-bold bg-blue-50/40 text-slate-700 border-r border-slate-200 print:bg-gray-50 print:border-gray-400">
                            {range.label}
                          </td>
                          {detailedClassStats.subjects.map(sub => {
                            const count = detailedClassStats.statsBySubject[sub.key].counts[range.label];
                            const maxCount = detailedClassStats.statsBySubject[sub.key].maxCount;
                            // 標示該科最多人分布的組距 (仿照參考圖的橘色底色)
                            const isMode = count > 0 && count === maxCount;
                            return (
                              <td
                                key={sub.key}
                                className={`py-1.5 px-2 border-r border-slate-100 last:border-r-0 print:border-gray-400 ${
                                  isMode ? 'bg-orange-200/70 font-bold text-orange-950 print:bg-orange-100' : 'text-slate-600'
                                }`}
                              >
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* 班平均 */}
                      <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300 print:border-gray-500">
                        <td className="py-1.5 px-2 font-bold bg-slate-200/70 text-slate-800 border-r border-slate-300 print:bg-gray-200 print:border-gray-400">班平均</td>
                        {detailedClassStats.subjects.map(sub => (
                          <td key={sub.key} className="py-1.5 px-2 text-slate-800 border-r border-slate-200 last:border-r-0 print:border-gray-400">
                            {detailedClassStats.statsBySubject[sub.key].mean}
                          </td>
                        ))}
                      </tr>

                      {/* 班高標 (前標 P75) */}
                      <tr className="bg-slate-50/60">
                        <td className="py-1.5 px-2 font-bold bg-slate-200/70 text-slate-800 border-r border-slate-300 print:bg-gray-200 print:border-gray-400" title="第75百分位數 (P75)">班高標</td>
                        {detailedClassStats.subjects.map(sub => (
                          <td key={sub.key} className="py-1.5 px-2 text-emerald-700 font-medium border-r border-slate-200 last:border-r-0 print:text-black print:border-gray-400">
                            {detailedClassStats.statsBySubject[sub.key].highMark}
                          </td>
                        ))}
                      </tr>

                      {/* 班低標 (後標 P25) */}
                      <tr className="bg-slate-50/60">
                        <td className="py-1.5 px-2 font-bold bg-slate-200/70 text-slate-800 border-r border-slate-300 print:bg-gray-200 print:border-gray-400" title="第25百分位數 (P25)">班低標</td>
                        {detailedClassStats.subjects.map(sub => (
                          <td key={sub.key} className="py-1.5 px-2 text-amber-700 font-medium border-r border-slate-200 last:border-r-0 print:text-black print:border-gray-400">
                            {detailedClassStats.statsBySubject[sub.key].lowMark}
                          </td>
                        ))}
                      </tr>

                      {/* 標準差 */}
                      <tr className="bg-slate-50/60">
                        <td className="py-1.5 px-2 font-bold bg-slate-200/70 text-slate-800 border-r border-slate-300 print:bg-gray-200 print:border-gray-400">標準差</td>
                        {detailedClassStats.subjects.map(sub => (
                          <td key={sub.key} className="py-1.5 px-2 text-slate-600 border-r border-slate-200 last:border-r-0 print:text-black print:border-gray-400">
                            {detailedClassStats.statsBySubject[sub.key].stdDev}
                          </td>
                        ))}
                      </tr>

                      {/* 相較全校平均比例 (%) */}
                      <tr className="bg-purple-50/60 font-bold border-t border-purple-200 print:bg-gray-100">
                        <td className="py-1.5 px-2 text-purple-900 bg-purple-100/70 border-r border-purple-200 print:bg-gray-200 print:text-black print:border-gray-400" title="(班平均 ÷ 全校平均) × 100%">佔全校比</td>
                        {detailedClassStats.subjects.map(sub => {
                          const s = detailedClassStats.statsBySubject[sub.key];
                          const isHigher = s.meanNum >= s.schoolAvgNum;
                          return (
                            <td key={sub.key} className={`py-1.5 px-1 border-r border-purple-100 last:border-r-0 print:border-gray-400 ${isHigher ? 'text-emerald-600 print:text-black' : 'text-rose-600 print:text-black'}`}>
                              {s.ratio}%
                              <span className="block text-[10px] font-normal text-slate-500">({s.diff})</span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between gap-2">
                  <span>* 橘底色塊代表該科目人數分布最多的分數組距（眾數區間）。</span>
                  <span>* 班高標為前標(P75)、班低標為後標(P25)。</span>
                </div>
              </div>

              {/* 右側：班級與全校平均比較雷達圖 (SVG) */}
              <div className="lg:col-span-5 print:col-span-5 bg-white shadow rounded-xl p-4 border border-slate-200 flex flex-col items-center justify-between print:shadow-none print:border-black">
                <div className="w-full text-center border-b border-slate-100 pb-2 mb-1">
                  <h4 className="font-bold text-slate-800 text-base">{selectedClass} 班 vs 全年級平均 分析雷達圖</h4>
                  <p className="text-xs text-slate-500">七大科目平均分數與相對比例分布 (0~100分)</p>
                </div>

                {/* SVG 七角雷達圖 */}
                {(() => {
                  const size = 300;
                  const center = size / 2;
                  const radius = 98;
                  const subs = detailedClassStats.subjects;
                  const totalAxes = subs.length; // 7科
                  const levels = [20, 40, 60, 80, 100];

                  const getPoint = (index, value) => {
                    const angle = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
                    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
                    return {
                      x: center + r * Math.cos(angle),
                      y: center + r * Math.sin(angle),
                      angle
                    };
                  };

                  // 全年級平均多邊形座標
                  const schoolPolygon = subs.map((sub, i) => {
                    const val = detailedClassStats.statsBySubject[sub.key].schoolAvgNum;
                    const pt = getPoint(i, val);
                    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                  }).join(' ');

                  // 班級平均多邊形座標
                  const classPolygon = subs.map((sub, i) => {
                    const val = detailedClassStats.statsBySubject[sub.key].meanNum;
                    const pt = getPoint(i, val);
                    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                  }).join(' ');

                  return (
                    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[290px] h-auto my-auto overflow-visible">
                      {/* 同心七角形背景格線 (20, 40, 60, 80, 100) */}
                      {levels.map(lvl => {
                        const pts = subs.map((_, i) => {
                          const pt = getPoint(i, lvl);
                          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                        }).join(' ');
                        return (
                          <polygon
                            key={lvl}
                            points={pts}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* 放射狀軸線 */}
                      {subs.map((_, i) => {
                        const endPt = getPoint(i, 100);
                        return (
                          <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke="#cbd5e1"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                          />
                        );
                      })}

                      {/* 刻度數值標示 (0, 20, 40, 60, 80, 100) */}
                      {[0, ...levels].map(lvl => (
                        <text
                          key={lvl}
                          x={center - 6}
                          y={center - (lvl / 100) * radius + 3}
                          fontSize="9"
                          fill="#64748b"
                          textAnchor="end"
                          className="font-semibold"
                        >
                          {lvl}
                        </text>
                      ))}

                      {/* 全年級平均區域 (綠色線條) */}
                      <polygon
                        points={schoolPolygon}
                        fill="rgba(16, 185, 129, 0.12)"
                        stroke="#10b981"
                        strokeWidth="2"
                      />

                      {/* 班級平均區域 (橘色線條) */}
                      <polygon
                        points={classPolygon}
                        fill="rgba(249, 115, 22, 0.22)"
                        stroke="#ea580c"
                        strokeWidth="2.5"
                      />

                      {/* 各科頂點圓點與標籤 (含相較全校之百分比) */}
                      {subs.map((sub, i) => {
                        const st = detailedClassStats.statsBySubject[sub.key];
                        const classPt = getPoint(i, st.meanNum);
                        const schoolPt = getPoint(i, st.schoolAvgNum);
                        const labelPt = getPoint(i, 126);
                        const isHigher = st.meanNum >= st.schoolAvgNum;

                        return (
                          <g key={sub.key}>
                            <circle cx={schoolPt.x} cy={schoolPt.y} r="3" fill="#10b981" />
                            <circle cx={classPt.x} cy={classPt.y} r="3.5" fill="#ea580c" />
                            <text
                              x={labelPt.x}
                              y={labelPt.y - 4}
                              fontSize="11"
                              fontWeight="bold"
                              fill="#334155"
                              textAnchor="middle"
                            >
                              {sub.label}
                            </text>
                            <text
                              x={labelPt.x}
                              y={labelPt.y + 9}
                              fontSize="9.5"
                              fontWeight="bold"
                              fill={isHigher ? '#059669' : '#e11d48'}
                              textAnchor="middle"
                            >
                              ({st.ratio}%)
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}

                {/* 圖例說明 */}
                <div className="w-full flex justify-center items-center gap-6 pt-2 border-t border-slate-100 text-xs font-bold">
                  <div className="flex items-center gap-2 text-orange-600">
                    <span className="w-5 h-1 bg-orange-600 rounded-full inline-block"></span>
                    <span>{selectedClass} 班平均</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <span className="w-5 h-1 bg-emerald-500 rounded-full inline-block"></span>
                    <span>全年級平均 (基準 100%)</span>
                  </div>
                </div>
              </div>

            </div>
          )}
          </div>
        ) : (
          /* --- 原有的總榜/班級列表 --- */
          <div className="table-container bg-white shadow rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-black">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 print:bg-gray-100 print:text-black select-none">
                <tr>
                  <th 
                    onClick={() => handleSort(viewMode === 'school' ? 'schoolRank' : 'classRank')}
                    className="px-3 py-3 text-center w-24 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依排名排序"
                  >
                    {viewMode === 'school' ? '全校排名' : '班級排名'}
                    {renderSortIcon(viewMode === 'school' ? 'schoolRank' : 'classRank')}
                  </th>
                  {viewMode === 'class' && (
                    <th 
                      onClick={() => handleSort('schoolRank')}
                      className="px-3 py-3 text-center w-24 whitespace-nowrap text-indigo-700 bg-indigo-50/40 print:bg-gray-100 print:text-black cursor-pointer hover:bg-indigo-100/60 transition-colors group"
                      title="點擊依全年級名次排序"
                    >
                      全年級名次
                      {renderSortIcon('schoolRank')}
                    </th>
                  )}
                  <th 
                    onClick={() => handleSort('classSeat')}
                    className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依班級與座號由小到大排序"
                  >
                    班級(座號)
                    {renderSortIcon('classSeat')}
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依姓名排序"
                  >
                    姓名
                    {renderSortIcon('name')}
                  </th>
                  <th 
                    onClick={() => handleSort('total')}
                    className="px-4 py-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依總分高低排序"
                  >
                    總分
                    {renderSortIcon('total')}
                  </th>
                  <th 
                    onClick={() => handleSort('chi')}
                    className="px-4 py-3 text-right hidden sm:table-cell print:table-cell whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依國文成績高低排序"
                  >
                    國文
                    {renderSortIcon('chi')}
                  </th>
                  <th 
                    onClick={() => handleSort('eng')}
                    className="px-4 py-3 text-right hidden sm:table-cell print:table-cell whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依英文成績高低排序"
                  >
                    英文
                    {renderSortIcon('eng')}
                  </th>
                  <th 
                    onClick={() => handleSort('math')}
                    className="px-4 py-3 text-right hidden sm:table-cell print:table-cell whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依數學成績高低排序"
                  >
                    數學
                    {renderSortIcon('math')}
                  </th>
                  <th 
                    onClick={() => handleSort('sci')}
                    className="px-4 py-3 text-right hidden sm:table-cell print:table-cell whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依自然成績高低排序"
                  >
                    自然
                    {renderSortIcon('sci')}
                  </th>
                  <th 
                    onClick={() => handleSort('social')}
                    className="px-4 py-3 text-right hidden sm:table-cell print:table-cell text-blue-600 whitespace-nowrap cursor-pointer hover:bg-blue-100/50 transition-colors group"
                    title="點擊依社會平均高低排序"
                  >
                    社會(均)
                    {renderSortIcon('social')}
                  </th>
                  <th 
                    onClick={() => handleSort('geo')}
                    className="px-4 py-3 text-right hidden lg:table-cell print:table-cell text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依地理成績高低排序"
                  >
                    地理
                    {renderSortIcon('geo')}
                  </th>
                  <th 
                    onClick={() => handleSort('hist')}
                    className="px-4 py-3 text-right hidden lg:table-cell print:table-cell text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依歷史成績高低排序"
                  >
                    歷史
                    {renderSortIcon('hist')}
                  </th>
                  <th 
                    onClick={() => handleSort('civ')}
                    className="px-4 py-3 text-right hidden lg:table-cell print:table-cell text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    title="點擊依公民成績高低排序"
                  >
                    公民
                    {renderSortIcon('civ')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-gray-300">
                {displayData.map((student) => {
                  const rank = viewMode === 'school' ? student.schoolRank : student.classRank; 
                  const rowBg = getClassColor(student.class);
                  return (
                    <tr key={`${student.class}-${student.seat}`} className={`${rowBg} hover:brightness-95 transition-all print:break-inside-avoid`}>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          rank <= 3 ? 'bg-amber-100 text-amber-700 print:border print:border-black' : 'bg-white/50 text-slate-500'
                        }`}>
                          {rank}
                        </span>
                        {viewMode === 'school' && renderRankChange(student.rankChange, student.prevSchoolRank)}
                      </td>
                      {viewMode === 'class' && (
                        <td className="px-3 py-3 text-center whitespace-nowrap font-bold text-indigo-700 bg-indigo-50/20 print:bg-transparent print:text-black">
                          {student.schoolRank}
                          {renderRankChange(student.rankChange, student.prevSchoolRank)}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{formatClassSeat(student.class, student.seat)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{student.name}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-800">{student.total}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell print:table-cell print:text-black">{student.chi}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell print:table-cell print:text-black">{student.eng}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell print:table-cell print:text-black">{student.math}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell print:table-cell print:text-black">{student.sci}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-bold hidden sm:table-cell print:table-cell print:text-black">{student.social}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden lg:table-cell print:table-cell print:text-black">{student.geo}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden lg:table-cell print:table-cell print:text-black">{student.hist}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden lg:table-cell print:table-cell print:text-black">{student.civ}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {viewMode === 'class' && selectedClass !== 'All' && (
              <div className="p-4 text-xs text-slate-500 bg-slate-50 border-t border-slate-200 no-print">
                本班級共有 {displayData.length} 位學生
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}