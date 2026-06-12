'use client';

import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import { ShieldCheck, Server, Key, Activity, AlertCircle, CheckCircle2, XCircle, Clock, FileDown, Trophy } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportData {
  projectName: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  severity: 'Healthy' | 'Degraded' | 'Critical';
  markdownResult: string;
  grade?: 'A' | 'B' | 'C' | 'F';
}

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setError(null);
    setReport(null);

    startTransition(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1/scan';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ targetUrl: url, authToken: token })
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.error || `API returned status ${res.status}`);
        }

        const data: ReportData = await res.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'Failed to reach the API. Please ensure the backend is running and the URL is valid.');
      }
    });
  };

  const downloadPDF = async () => {
    const element = document.getElementById('report-container');
    if (!element) return;
    
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        allowTaint: true,
        backgroundColor: '#0a0a0a' 
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CoderNest-Audit-${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-indigo-500/30">
      {/* Navbar / Hero */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                CoderNest QA Core
              </h1>
              <p className="text-xs text-neutral-400">Industry-Grade Automated Audit & Diagnostic Framework</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {/* Audit Form Section */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
          
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-400" />
              New Audit Scan
            </h2>
            <p className="text-neutral-400">Enter the target environment details to trigger a full diagnostic and security pulse.</p>
          </div>

          <form onSubmit={handleAudit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Target URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Server className="w-4 h-4 text-neutral-500" />
                  Target URL / Domain <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm outline-none transition-all"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {/* Bearer Token */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Key className="w-4 h-4 text-neutral-500" />
                  Bearer Token <span className="text-neutral-500">(Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm outline-none transition-all font-mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !url}
              className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Running Audit...
                </>
              ) : (
                'Run Quality Audit'
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-950/50 border border-red-900/50 rounded-lg flex items-start gap-3 text-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </section>

        {/* Results Dashboard */}
        {report && (
          <section id="report-container" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-neutral-950 p-4 -mx-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
              <h2 className="text-2xl font-semibold flex items-center gap-3">
                Audit Results
                {report.grade && (
                  <span className={`text-sm px-3 py-1 rounded-full border font-bold flex items-center gap-1
                    ${report.grade === 'A' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                      report.grade === 'B' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 
                      report.grade === 'C' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 
                      'bg-red-500/20 text-red-400 border-red-500/30'}
                  `}>
                    <Trophy className="w-4 h-4" /> Grade {report.grade}
                  </span>
                )}
              </h2>
              
              <button
                onClick={downloadPDF}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 text-sm font-medium rounded-lg transition-all flex items-center gap-2 border border-neutral-700"
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-100 rounded-full animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" /> Download PDF Report
                  </>
                )}
              </button>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <div className="text-neutral-400 text-sm mb-1 flex items-center gap-2"><Activity className="w-4 h-4" /> Total Tests</div>
                <div className="text-3xl font-bold">{report.totalTests}</div>
              </div>
              <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-5 shadow-sm">
                <div className="text-emerald-400 text-sm mb-1 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Passed</div>
                <div className="text-3xl font-bold text-emerald-500">{report.passed}</div>
              </div>
              <div className="bg-red-950/30 border border-red-900/30 rounded-xl p-5 shadow-sm">
                <div className="text-red-400 text-sm mb-1 flex items-center gap-2"><XCircle className="w-4 h-4" /> Failed</div>
                <div className="text-3xl font-bold text-red-500">{report.failed}</div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <div className="text-neutral-400 text-sm mb-1 flex items-center gap-2"><Clock className="w-4 h-4" /> Health Status</div>
                <div className={`text-2xl font-bold ${report.severity === 'Healthy' ? 'text-emerald-500' : report.severity === 'Critical' ? 'text-red-500' : 'text-yellow-500'}`}>
                  {report.severity}
                </div>
              </div>
            </div>

            {/* Markdown Report Render */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-10 shadow-xl overflow-x-auto">
              <div className="prose prose-invert prose-indigo max-w-none prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-neutral-800 prose-th:bg-neutral-800/50 prose-th:p-3 prose-td:p-3 prose-tr:border-b-neutral-800">
                <ReactMarkdown>{report.markdownResult}</ReactMarkdown>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
