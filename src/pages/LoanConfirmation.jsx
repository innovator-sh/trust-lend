import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';

export default function LoanConfirmation() {
  return (
    <AppShell pageTitle="Facility Confirmation" pageSubtitle="Finalize your decentralized credit agreement">
      <div className="p-4 md:p-8 lg:p-12 max-w-[1000px] mx-auto space-y-12">
        
        {/* Confirmation Hero */}
        <div className="bg-white p-12 md:p-16 rounded-[4rem] border border-[#E8E8E8] luxury-shadow relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#D4AF37] opacity-[0.02] blur-[100px] transition-transform group-hover:scale-110 -z-10"></div>
           
           <div className="flex flex-col items-center text-center space-y-10">
              <div className="px-6 py-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                 <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Protocol Finalization</span>
              </div>
              
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.3em]">Requested Capital Drawdown</p>
                 <h2 className="font-cabinet text-7xl md:text-8xl font-black text-[#1A1A1A] tracking-tighter leading-none">$2,500.00</h2>
              </div>

              <div className="w-full max-w-xl grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                 <div className="bg-[#FAFAF8] p-8 rounded-[2.5rem] border border-[#E8E8E8] text-left">
                    <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] mb-4">Yield Encumbrance</p>
                    <p className="text-3xl font-black text-[#1A1A1A] tracking-tighter">4.2% <span className="text-sm text-[#D4AF37]">APY</span></p>
                 </div>
                 <div className="bg-[#FAFAF8] p-8 rounded-[2.5rem] border border-[#E8E8E8] text-left">
                    <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] mb-4">Maturity Horizon</p>
                    <p className="text-3xl font-black text-[#1A1A1A] tracking-tighter">12 <span className="text-sm text-[#8C8C8C]">Weeks</span></p>
                 </div>
              </div>
           </div>
        </div>

        {/* Accountability Audit */}
        <div className="bg-white p-10 md:p-14 rounded-[3.5rem] border border-[#E8E8E8] luxury-shadow space-y-10">
           <h3 className="font-cabinet text-3xl font-black text-[#1A1A1A] tracking-tight">Archway Verification</h3>
           
           <div className="space-y-8">
              {[
                { label: 'Collateral Mechanism', value: 'Sovereign Reputation NFT', icon: 'lucide:shield-check' },
                { label: 'Repayment Structure', value: 'Amortized Weekly Loop', icon: 'lucide:refresh-cw' },
                { label: 'Total Obligations', value: '$2,605.00', icon: 'lucide:scale', color: 'text-[#D4AF37]' }
              ].map((item, i) => (
                 <div key={i} className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 border-b border-[#F5F3F0] group hover:px-4 transition-all duration-300">
                    <div className="flex items-center gap-4 mb-2 md:mb-0">
                       <iconify-icon icon={item.icon} className="text-[#8C8C8C] text-xl group-hover:text-[#D4AF37] transition-colors"></iconify-icon>
                       <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">{item.label}</span>
                    </div>
                    <span className={`text-xl font-black tracking-tight ${item.color || 'text-[#1A1A1A]'}`}>{item.value}</span>
                 </div>
              ))}
           </div>
        </div>

        {/* Warning Indicator */}
        <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] flex items-center gap-8 luxury-shadow-sm">
           <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-rose-500 shadow-sm shrink-0 border border-rose-50">
              <iconify-icon icon="lucide:alert-triangle" className="text-3xl animate-pulse"></iconify-icon>
           </div>
           <div>
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Risk Protocol Acknowledgment</p>
              <p className="text-sm font-medium text-rose-900/60 leading-relaxed tracking-tight">
                Failure to repay this facility will initiate <span className="text-[#1A1A1A] font-black">Reputation Slashing</span>. This action is immutable and globally broadcasted.
              </p>
           </div>
        </div>

        {/* Execution Vector */}
        <div className="flex flex-col sm:flex-row gap-6">
           <Link to="/borrow" className="flex-1 py-6 rounded-full border border-[#E8E8E8] text-[#8C8C8C] font-black uppercase text-[12px] tracking-[0.3em] text-center hover:bg-[#FAFAF8] transition-all">
              Edit Parameters
           </Link>
           <Link to="/loan-success" className="flex-[2] py-6 rounded-full bg-[#1A1A1A] text-white font-black uppercase text-[12px] tracking-[0.3em] text-center luxury-shadow hover:bg-[#D4AF37] hover:scale-105 transition-all flex items-center justify-center gap-4 group active:scale-95 shadow-2xl">
              Sign Protocol Transaction <iconify-icon icon="lucide:pen-tool" className="text-lg group-hover:rotate-12 transition-transform ml-2"></iconify-icon>
           </Link>
        </div>
      </div>
    </AppShell>
  );
}
