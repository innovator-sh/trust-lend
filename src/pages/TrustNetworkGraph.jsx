import React, { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import { useVouchSystem } from '../hooks/useVouchSystem';
import { useReputationNFT } from '../hooks/useReputationNFT';
import { useWallet } from '../context/WalletContext';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';

const shortAddr = (a = '') => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';

export default function TrustNetworkGraph() {
  const { vouches, vouchRequests, isLoading } = useVouchSystem();
  const { trustScore } = useReputationNFT();
  const { address } = useWallet();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!svgRef.current || !address) return;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 600;
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    const container = svg.append("g");

    // Zoom
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      }));

    // Data prep
    const nodes = [
      { id: address, label: "Me", score: Number(trustScore), isCenter: true, type: 'borrower' }
    ];
    const links = [];

    vouches.forEach(v => {
      nodes.push({ id: v.voucher, label: shortAddr(v.voucher), score: 70, amount: v.amount, type: 'voucher' });
      links.push({ source: address, target: v.voucher, value: Number(v.amount) });
    });

    // If empty state, add ghost nodes
    const isPlaceholder = vouches.length === 0;
    if (isPlaceholder) {
        nodes.push({ id: 'g1', label: 'Invite', type: 'ghost' });
        nodes.push({ id: 'g2', label: 'Invite', type: 'ghost' });
        nodes.push({ id: 'g3', label: 'Invite', type: 'ghost' });
        links.push({ source: address, target: 'g1', value: 5, isGhost: true });
        links.push({ source: address, target: 'g2', value: 5, isGhost: true });
        links.push({ source: address, target: 'g3', value: 5, isGhost: true });
    }

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Links
    const link = container.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.isGhost ? "#1E2A3A" : "#F5A623")
      .attr("stroke-opacity", d => d.isGhost ? 0.3 : 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value) * 1.5 || 2)
      .attr("stroke-dasharray", d => d.isGhost ? "5,5" : "none");

    const node = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }))
      .on("click", (e, d) => setSelectedNode(d));

    // Node circles
    node.append("circle")
      .attr("r", d => d.isCenter ? 40 : 25)
      .attr("fill", d => d.type === 'ghost' ? "transparent" : d.isCenter ? "#F5A623" : "#0A0F1E")
      .attr("stroke", d => d.type === 'ghost' ? "#1E2A3A" : d.isCenter ? "#D4AF37" : "#F5A623")
      .attr("stroke-width", d => d.isCenter ? 4 : 2)
      .attr("stroke-dasharray", d => d.type === 'ghost' ? "4,4" : "none")
      .attr("class", d => d.isCenter ? "animate-pulse shadow-glow" : "");

    // Text labels
    node.append("text")
      .attr("dy", d => d.isCenter ? 65 : 45)
      .attr("text-anchor", "middle")
      .attr("fill", "#FAFAF8")
      .attr("font-size", "10px")
      .attr("font-weight", "black")
      .attr("text-transform", "uppercase")
      .attr("letter-spacing", "0.1em")
      .text(d => d.label);

    // Score display on center
    node.filter(d => d.isCenter).append("text")
      .attr("dy", 10)
      .attr("text-anchor", "middle")
      .attr("fill", "#000")
      .attr("font-size", "18px")
      .attr("font-weight", "black")
      .text(d => d.score);

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [vouches, address, trustScore]);

  return (
    <AppShell pageTitle="Topology Graph" pageSubtitle="Real-time Trust Visualizer">
      <div className="max-w-7xl mx-auto space-y-10 pb-24">
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 bg-white dark:bg-[#111827] rounded-[24px] border border-[#E8E8E8] dark:border-[#1E2A3A] relative overflow-hidden h-[600px]">
            <div className="absolute top-8 left-8 flex flex-col gap-2 z-20">
               <span className="px-3 py-1 rounded-full bg-[#F5A623]/10 border border-[#F5A623]/20 text-[9px] font-black uppercase tracking-widest text-[#F5A623]">
                   Live Syndicate Mesh
               </span>
               <p className="text-[10px] text-[#8C8C8C] uppercase font-bold tracking-widest">Network Score Influence: +{vouches.length * 5} pts</p>
            </div>

            <div className="absolute bottom-8 right-8 flex gap-3 z-20">
                <button onClick={() => navigate('/invite-vouch')} className="px-6 py-3 bg-[#F5A623] text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                    + Expand Network
                </button>
            </div>

            <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
            
            {vouches.length === 0 && (
                <div className="absolute inset-x-0 bottom-32 flex justify-center pointer-events-none">
                    <div className="text-center bg-[#111827]/80 backdrop-blur px-8 py-4 rounded-2xl border border-[#1E2A3A]">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FAFAF8] mb-1">Syndicate Mesh Empty</p>
                        <p className="text-[10px] text-[#8C8C8C] uppercase tracking-widest font-bold font-cabinet">Invite friends to vouch and strengthen your node</p>
                    </div>
                </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-[24px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-[#8C8C8C] mb-6">Syndicate Details</h4>
                <div className="space-y-6">
                   <div className="flex justify-between items-end border-b border-[#1E2A3A] pb-4">
                      <p className="text-[10px] font-bold text-[#8C8C8C] uppercase tracking-widest">Active Links</p>
                      <p className="text-2xl font-black text-[#F5A623] font-cabinet">{vouches.length}</p>
                   </div>
                   <div className="flex justify-between items-end border-b border-[#1E2A3A] pb-4">
                      <p className="text-[10px] font-bold text-[#8C8C8C] uppercase tracking-widest">Pending Req</p>
                      <p className="text-2xl font-black text-[#F59E0B] font-cabinet">{vouchRequests.length}</p>
                   </div>
                   <div className="flex justify-between items-end">
                      <p className="text-[10px] font-bold text-[#8C8C8C] uppercase tracking-widest">Network Growth</p>
                      <p className="text-2xl font-black text-[#1D9E75] font-cabinet">12% MoM</p>
                   </div>
                </div>
            </div>

            <div className="bg-[#111827] border border-[#1E2A3A] rounded-[24px] overflow-hidden">
                <div className="p-6 border-b border-[#1E2A3A]">
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#FAFAF8]">Active Attestations</p>
                </div>
                <div className="overflow-y-auto max-h-[300px]">
                   {vouches.length === 0 ? (
                       <div className="p-8 text-center text-[10px] text-[#8C8C8C] uppercase font-bold">No active links</div>
                   ) : (
                       vouches.map((v, i) => (
                           <div key={i} className="p-4 border-b border-[#1E2A3A] last:border-0 hover:bg-[#1E2A3A]/20 transition-all">
                               <div className="flex justify-between items-center">
                                   <div>
                                       <p className="text-[10px] font-black font-mono text-[#FAFAF8]">{shortAddr(v.voucher)}</p>
                                       <p className="text-[8px] text-[#8C8C8C] uppercase font-bold mt-1">Staked {v.amount} TRUST</p>
                                   </div>
                                   <div className="p-2 bg-[#1D9E75]/10 rounded-lg text-[#1D9E75] text-[10px] font-black uppercase">
                                       Live
                                   </div>
                               </div>
                           </div>
                       ))
                   )}
                </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
