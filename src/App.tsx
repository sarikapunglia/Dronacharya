import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  ClipboardList, 
  User, 
  PlusCircle, 
  History, 
  TrendingUp, 
  Award, 
  LogOut, 
  Printer, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  BrainCircuit,
  Target,
  AlertCircle,
  Loader2,
  Download,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateQuestions, evaluateAnswers, Question } from './services/geminiService';
import { dataService } from './services/dataService';
import { Student, Test } from './types';
import { cn } from './lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import IconGenerator from './components/IconGenerator';

const App: React.FC = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'generate' | 'test-view' | 'enter-answers' | 'history' | 'icons'>('login');
  const [history, setHistory] = useState<Test[]>([]);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ name: '', age: '', className: '' });
  const [testParams, setTestParams] = useState({ 
    topic: '', 
    complexity: 'Medium' as 'Easy' | 'Medium' | 'Hard', 
    concepts: '' 
  });
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    const initData = async () => {
      try {
        await dataService.init();
      } catch (err: any) {
        console.error("Data init failed:", err);
        setInitError(err.message || "Database initialization failed");
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (student) {
      fetchHistory();
    }
  }, [student]);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Initialization Error</h1>
          <p className="text-slate-600 mb-4">{initError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const fetchHistory = async () => {
    if (!student) return;
    try {
      const data = await dataService.getHistory(student.id);
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await dataService.login(
        loginForm.name, 
        parseInt(loginForm.age) || 0, 
        loginForm.className
      );
      setStudent(data);
      setView('dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      alert("Login failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setLoading(true);
    try {
      const questions = await generateQuestions({
        age: student.age,
        className: student.class,
        ...testParams
      });
      
      const { id } = await dataService.saveTest(
        student.id,
        testParams.topic,
        testParams.complexity,
        testParams.concepts,
        questions
      );
      
      const newTest: Test = {
        id,
        student_id: student.id,
        topic: testParams.topic,
        complexity: testParams.complexity,
        concepts: testParams.concepts,
        questions,
        created_at: new Date().toISOString()
      };
      
      setCurrentTest(newTest);
      setView('test-view');
    } catch (error) {
      alert("Failed to generate test");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTest || !student) return;
    setLoading(true);
    try {
      const result = await evaluateAnswers(
        currentTest.questions,
        studentAnswers,
        {
          age: student.age,
          className: student.class,
          topic: currentTest.topic,
          complexity: currentTest.complexity as any,
          concepts: currentTest.concepts
        }
      );

      await dataService.saveResult(
        currentTest.id,
        studentAnswers,
        result.score,
        result.feedback,
        result.analysis
      );

      await fetchHistory();
      setView('dashboard');
      setStudentAnswers({});
      setCurrentTest(null);
    } catch (error) {
      alert("Failed to submit answers");
    } finally {
      setLoading(false);
    }
  };

  const printTest = () => {
    console.log("Print button clicked, triggering window.print()");
    // Adding a small delay to ensure UI is ready
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const downloadPDF = async () => {
    const element = document.querySelector('.print-content') as HTMLElement;
    if (!element) return;

    setLoading(true);
    try {
      // Create a clone of the element to modify it for the PDF without affecting the UI
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('.print-content') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.width = '800px'; // Force a stable width for the PDF capture
            // Ensure all options are visible and styled simply
            const options = clonedElement.querySelectorAll('.option-container');
            options.forEach((opt: any) => {
              opt.style.display = 'block';
              opt.style.marginBottom = '10px';
              opt.style.border = '1px solid #e2e8f0';
              opt.style.padding = '10px';
            });
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      let pageIndex = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        pageIndex++;
        position = -(pageIndex * pdfHeight);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${currentTest?.topic || 'test'}-questionnaire.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try the Print button or Ctrl+P.");
    } finally {
      setLoading(false);
    }
  };

  const getProfileStats = () => {
    if (history.length === 0) return null;
    const completed = history.filter(h => h.score !== null);
    if (completed.length === 0) return null;
    
    const avgScore = completed.reduce((acc, curr) => acc + (curr.score || 0), 0) / completed.length;
    
    const strengths = new Set<string>();
    const weaknesses = new Set<string>();
    
    completed.forEach(h => {
      h.analysis?.strengths.forEach(s => strengths.add(s));
      h.analysis?.weaknesses.forEach(w => weaknesses.add(w));
    });

    return {
      avgScore: Math.round(avgScore),
      totalTests: history.length,
      completedTests: completed.length,
      strengths: Array.from(strengths).slice(0, 3),
      weaknesses: Array.from(weaknesses).slice(0, 3)
    };
  };

  const stats = getProfileStats();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      {student && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <BookOpen className="text-white w-6 h-6" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  dronACHARYA
                </span>
              </div>
              
              <div className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => setView('dashboard')}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-md transition-colors", 
                    view === 'dashboard' ? "text-indigo-600 bg-indigo-50 font-medium" : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50")}
                >
                  <TrendingUp className="w-4 h-4" /> Dashboard
                </button>
                <button 
                  onClick={() => setView('generate')}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-md transition-colors", 
                    view === 'generate' ? "text-indigo-600 bg-indigo-50 font-medium" : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50")}
                >
                  <PlusCircle className="w-4 h-4" /> New Test
                </button>
                <button 
                  onClick={() => setView('history')}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-md transition-colors", 
                    view === 'history' ? "text-indigo-600 bg-indigo-50 font-medium" : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50")}
                >
                  <History className="w-4 h-4" /> History
                </button>
                <button 
                  onClick={() => setView('icons')}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-md transition-colors", 
                    view === 'icons' ? "text-indigo-600 bg-indigo-50 font-medium" : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50")}
                >
                  <Sparkles className="w-4 h-4" /> Design Lab
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-slate-900">{student.name}</span>
                  <span className="text-xs text-slate-500">Class {student.class}</span>
                </div>
                <button 
                  onClick={() => { setStudent(null); setView('login'); }}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {/* Login View */}
          {view === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto mt-20"
            >
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="text-center mb-8">
                  <div className="inline-block bg-indigo-100 p-4 rounded-full mb-4">
                    <User className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900">Welcome to dronACHARYA</h1>
                  <p className="text-slate-500 mt-2">Enter student details to start learning</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Student Name</label>
                    <input 
                      required
                      type="text"
                      value={loginForm.name}
                      onChange={(e) => setLoginForm({...loginForm, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                      <input 
                        required
                        type="number"
                        value={loginForm.age}
                        onChange={(e) => setLoginForm({...loginForm, age: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                      <input 
                        required
                        type="text"
                        value={loginForm.className}
                        onChange={(e) => setLoginForm({...loginForm, className: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                        placeholder="e.g. 5th Grade"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Started'}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-sm text-slate-500 mb-4">Need an app icon for the Play Store?</p>
                  <button 
                    onClick={() => setView('icons')}
                    className="text-indigo-600 font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                  >
                    <Sparkles className="w-4 h-4" /> Open Design Lab
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Dashboard View */}
          {view === 'dashboard' && student && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Hello, {student.name}! 👋</h1>
                  <p className="text-slate-500">Here's your learning progress overview.</p>
                </div>
                <button 
                  onClick={() => setView('generate')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 font-semibold transition-all hover:scale-105"
                >
                  <PlusCircle className="w-5 h-5" /> Generate New Test
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-xl">
                    <ClipboardList className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Tests</p>
                    <p className="text-2xl font-bold text-slate-900">{stats?.totalTests || 0}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-green-100 p-3 rounded-xl">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Average Score</p>
                    <p className="text-2xl font-bold text-slate-900">{stats?.avgScore || 0}%</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-purple-100 p-3 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Completion Rate</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {stats ? Math.round((stats.completedTests / stats.totalTests) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Profile Analysis */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BrainCircuit className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-slate-900">Learning Profile</h2>
                  </div>
                  
                  {stats ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Expertise Areas
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {stats.strengths.map((s, i) => (
                            <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> Focus Areas
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {stats.weaknesses.map((w, i) => (
                            <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Complete your first test to see your profile analysis!</p>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <History className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold text-slate-900">Recent Tests</h2>
                    </div>
                    <button onClick={() => setView('history')} className="text-indigo-600 text-sm font-semibold hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="space-y-4">
                    {history.slice(0, 3).map((test) => (
                      <div key={test.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-lg", test.score !== null ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{test.topic}</p>
                            <p className="text-xs text-slate-500">{new Date(test.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {test.score !== null ? (
                            <span className="text-lg font-bold text-indigo-600">{test.score}%</span>
                          ) : (
                            <button 
                              onClick={() => { setCurrentTest(test); setView('enter-answers'); }}
                              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full hover:bg-indigo-100 transition-colors"
                            >
                              Enter Answers
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <p>No tests generated yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Generate Test View */}
          {view === 'generate' && (
            <motion.div 
              key="generate"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    <PlusCircle className="text-white w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Create New Questionnaire</h2>
                </div>

                <form onSubmit={handleGenerateTest} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject / Topic</label>
                    <input 
                      required
                      type="text"
                      value={testParams.topic}
                      onChange={(e) => setTestParams({...testParams, topic: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. Photosynthesis, Ancient Rome, Fractions"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Complexity Level</label>
                    <div className="grid grid-cols-3 gap-4">
                      {['Easy', 'Medium', 'Hard'].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setTestParams({...testParams, complexity: level as any})}
                          className={cn(
                            "py-3 rounded-xl font-semibold border transition-all",
                            testParams.complexity === level 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Key Concepts (Optional)</label>
                    <textarea 
                      value={testParams.concepts}
                      onChange={(e) => setTestParams({...testParams, concepts: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                      placeholder="Specific areas you want to focus on..."
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setView('dashboard')}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Questionnaire'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* Test View (Printable) */}
          {view === 'test-view' && currentTest && (
            <motion.div 
              key="test-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto print-content print:opacity-100 print:transform-none"
            >
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
                <div className="flex justify-between items-start mb-12 print:mb-8">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{currentTest.topic}</h1>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>Level: {currentTest.complexity}</span>
                      <span>•</span>
                      <span>Date: {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 print:hidden">
                    <button 
                      onClick={downloadPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 font-semibold transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    <button 
                      onClick={printTest}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button 
                      onClick={() => setView('enter-answers')}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors"
                    >
                      Enter Answers
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12 p-6 bg-slate-50 rounded-xl border border-slate-100 print:bg-transparent print:border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Student Name</p>
                    <p className="text-lg font-semibold text-slate-900 border-b-2 border-slate-200 pb-1 min-h-[2rem]">{student?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Class</p>
                    <p className="text-lg font-semibold text-slate-900 border-b-2 border-slate-200 pb-1 min-h-[2rem]">{student?.class}</p>
                  </div>
                </div>

                <div className="space-y-12">
                  {currentTest.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-4 question-block">
                      <div className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-xl font-medium text-slate-900 pt-0.5">{q.question}</p>
                      </div>
                      
                      {q.options ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-12">
                          {q.options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg option-container">
                              <div className="w-4 h-4 border-2 border-slate-300 rounded-full flex-shrink-0" />
                              <span className="text-slate-700">{opt}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ml-12 h-32 border-b-2 border-slate-100 border-dashed" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-20 pt-8 border-t border-slate-100 text-center text-slate-400 text-sm hidden print:block">
                  Generated by dronACHARYA Learning Assistant
                </div>
              </div>
            </motion.div>
          )}

          {/* Enter Answers View */}
          {view === 'enter-answers' && currentTest && (
            <motion.div 
              key="enter-answers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Submit Answers</h2>
                  <p className="text-slate-500">Provide the answers you solved offline for scoring.</p>
                </div>

                <form onSubmit={handleSubmitAnswers} className="space-y-8">
                  {currentTest.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-4 p-6 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="font-semibold text-slate-900">{idx + 1}. {q.question}</p>
                      
                      {q.options ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt, i) => (
                            <label key={i} className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                              studentAnswers[q.id] === opt 
                                ? "bg-indigo-600 border-indigo-600 text-white" 
                                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                            )}>
                              <input 
                                type="radio" 
                                name={`q-${q.id}`} 
                                value={opt}
                                checked={studentAnswers[q.id] === opt}
                                onChange={(e) => setStudentAnswers({...studentAnswers, [q.id]: e.target.value})}
                                className="hidden"
                              />
                              <span className="text-sm font-medium">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea 
                          required
                          value={studentAnswers[q.id] || ''}
                          onChange={(e) => setStudentAnswers({...studentAnswers, [q.id]: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                          placeholder="Type your answer here..."
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setView('dashboard')}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit for Evaluation'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* History View */}
          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900">Test History</h1>
                <button 
                  onClick={() => setView('dashboard')}
                  className="text-indigo-600 font-semibold flex items-center gap-2 hover:underline"
                >
                  Back to Dashboard
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {history.map((test) => (
                  <div key={test.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-slate-900">{test.topic}</h3>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider",
                            test.complexity === 'Easy' ? "bg-green-100 text-green-700" :
                            test.complexity === 'Medium' ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                          )}>
                            {test.complexity}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Generated on {new Date(test.created_at).toLocaleDateString()} at {new Date(test.created_at).toLocaleTimeString()}
                        </p>
                        {test.concepts && (
                          <p className="text-sm text-slate-600 italic">Focus: {test.concepts}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-6">
                        {test.score !== null ? (
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase">Score</p>
                            <p className="text-3xl font-black text-indigo-600">{test.score}%</p>
                          </div>
                        ) : (
                          <button 
                            onClick={() => { setCurrentTest(test); setView('enter-answers'); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all"
                          >
                            Enter Answers
                          </button>
                        )}
                        
                        <button 
                          onClick={() => { setCurrentTest(test); setView('test-view'); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Printer className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {test.feedback && (
                      <div className="mt-6 pt-6 border-t border-slate-100">
                        <p className="text-slate-700 mb-4">{test.feedback}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                            <p className="text-xs font-bold text-green-600 uppercase mb-2">Strengths</p>
                            <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                              {test.analysis?.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                            <p className="text-xs font-bold text-amber-600 uppercase mb-2">Suggestions</p>
                            <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                              {test.analysis?.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                    <ClipboardList className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400">Your test history is empty.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Icon Design Lab View */}
          {view === 'icons' && (
            <motion.div
              key="icons"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-6 flex justify-between items-center">
                <button 
                  onClick={() => setView(student ? 'dashboard' : 'login')}
                  className="text-indigo-600 font-bold flex items-center gap-2 hover:underline"
                >
                  ← Back to {student ? 'Dashboard' : 'Login'}
                </button>
              </div>
              <IconGenerator />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <BrainCircuit className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto" />
          </div>
          <p className="mt-4 text-slate-600 font-semibold animate-pulse">
            {view === 'generate' ? 'Gemini is crafting your questions...' : 
             view === 'enter-answers' ? 'Evaluating your performance...' : 'Please wait...'}
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
