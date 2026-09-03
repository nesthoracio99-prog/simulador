import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, Cpu, Wifi, Zap, RefreshCw, Settings, Power, 
  Layers, Plus, Trash2, CheckCircle2, AlertCircle, Play, 
  RotateCcw, Compass, HelpCircle, ShieldAlert, Send, Sparkles, MessageSquare
} from 'lucide-react';

// --- DEFINICIONES DE HARDWARE Y COMPONENTES SIMULADOS ---
const LMU_PINS = [
  { id: "PWR", label: "PWR 12V", color: "#ef4444" },
  { id: "GND", label: "GND", color: "#10b981" },
  { id: "OUT0", label: "OUT0 (Paro)", color: "#38bdf8" },
  { id: "OUT1", label: "OUT1 (Aux)", color: "#38bdf8" },
  { id: "OUT2", label: "OUT2 (Buzzer)", color: "#38bdf8" }
];

const COMP_PINS = {
  relay: [
    { id: "85", label: "85 COIL", color: "#f59e0b" },
    { id: "86", label: "86 COIL", color: "#f59e0b" },
    { id: "30", label: "30 COM", color: "#e2e8f0" },
    { id: "87a", label: "87a NC", color: "#94a3b8" },
    { id: "87", label: "87 NO", color: "#e2e8f0" }
  ],
  lamp: [
    { id: "A", label: "L+", color: "#fde047" },
    { id: "B", label: "L- GND", color: "#10b981" }
  ]
};

const COMP_SIZES = {
  lmu: { w: 260, h: 130 },
  relay: { w: 110, h: 78 },
  lamp: { w: 72, h: 72 }
};

const PIN_OFFSETS = {
  lmu: {
    PWR: { x: 12, y: 12 },
    GND: { x: 12, y: 92 },
    OUT0: { x: 228, y: 10 },
    OUT1: { x: 228, y: 48 },
    OUT2: { x: 228, y: 86 }
  },
  relay: {
    "85": { x: 12, y: -22 },
    "86": { x: 78, y: -22 },
    "30": { x: 6, y: 68 },
    "87a": { x: 45, y: 68 },
    "87": { x: 84, y: 68 }
  },
  lamp: {
    A: { x: 26, y: -22 },
    B: { x: 26, y: 72 }
  }
};

class DisjointSet {
  constructor(elements) {
    this.parent = new Map();
    this.rank = new Map();
    elements.forEach(el => {
      this.parent.set(el, el);
      this.rank.set(el, 0);
    });
  }
  find(i) {
    let root = this.parent.get(i);
    if (root !== i) {
      root = this.find(root);
      this.parent.set(i, root);
    }
    return root;
  }
  union(i, j) {
    let rootI = this.find(i);
    let rootJ = this.find(j);
    if (rootI !== rootJ) {
      let rankI = this.rank.get(rootI);
      let rankJ = this.rank.get(rootJ);
      if (rankI < rankJ) {
        this.parent.set(rootI, rootJ);
      } else if (rankI > rankJ) {
        this.parent.set(rootJ, rootI);
      } else {
        this.parent.set(rootJ, rootI);
        this.rank.set(rootI, rankI + 1);
      }
      return true;
    }
    return false;
  }
}

function getDefaultCircuit() {
  return {
    comps: [
      { id: "LMU", type: "lmu", x: 24, y: 40 },
      { id: "R1", type: "relay", x: 340, y: 120 },
      { id: "L1", type: "lamp", x: 500, y: 160 }
    ],
    wires: [
      { id: "W1", a: { cId: "LMU", pinId: "OUT0" }, b: { cId: "R1", pinId: "85" } },
      { id: "W2", a: { cId: "R1", pinId: "86" }, b: { cId: "LMU", pinId: "GND" } },
      { id: "W3", a: { cId: "LMU", pinId: "PWR" }, b: { cId: "R1", pinId: "30" } },
      { id: "W4", a: { cId: "R1", pinId: "87" }, b: { cId: "L1", pinId: "A" } },
      { id: "W5", a: { cId: "L1", pinId: "B" }, b: { cId: "LMU", pinId: "GND" } }
    ],
    outs: [true, false, false]
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'telemetry' | 'ai'
  const [components, setComponents] = useState(() => getDefaultCircuit().comps);
  const [wires, setWires] = useState(() => getDefaultCircuit().wires);
  const [lmuOutputs, setLmuOutputs] = useState(() => getDefaultCircuit().outs);
  const [connectingPin, setConnectingPin] = useState(null);
  const [selectedWireId, setSelectedWireId] = useState(null);
  const [selectedWireCenter, setSelectedWireCenter] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [nextId, setNextId] = useState(10);
  
  // Estados para el Asistente de IA con Gemini API
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: '¡Hola! Soy tu Arquitecto de Hardware LMU-2630 impulsado por Gemini. Puedo analizar tu diagrama eléctrico en tiempo real, diagnosticar fallas o sugerir mejoras de cableado.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const canvasBgRef = useRef(null);
  const canvasWiresRef = useRef(null);
  const workspaceRef = useRef(null);
  const animFrameRef = useRef(null);
  const animProgressRef = useRef(0);
  const compPositionsRef = useRef(new Map());

  const getPinAbsoluteCoords = useCallback((cId, pinId) => {
    const comp = components.find(c => c.id === cId);
    const pos = compPositionsRef.current.get(cId) || (comp ? { x: comp.x, y: comp.y } : { x: 0, y: 0 });
    const cType = comp ? comp.type : (cId === "LMU" ? "lmu" : "relay");
    const offset = PIN_OFFSETS[cType]?.[pinId] || { x: 0, y: 0 };
    return { x: pos.x + offset.x + 10, y: pos.y + offset.y + 10 };
  }, [components]);

  // --- MOTOR DE SIMULACIÓN ELÉCTRICA (CÁLCULO DE MALLAS) ---
  useEffect(() => {
    const allPinNames = [];
    components.forEach(c => {
      const pins = c.type === 'lmu' ? LMU_PINS : COMP_PINS[c.type];
      pins.forEach(p => allPinNames.push(`${c.id}:${p.id}`));
    });

    const ds = new DisjointSet(allPinNames);
    wires.forEach(w => {
      const pinA = `${w.a.cId}:${w.a.pinId}`;
      const pinB = `${w.b.cId}:${w.b.pinId}`;
      if (ds.parent.has(pinA) && ds.parent.has(pinB)) {
        ds.union(pinA, pinB);
      }
    });

    let relayStates = new Map();
    let converged = false;
    let iterations = 0;

    while (!converged && iterations < 15) {
      iterations++;
      let rootsMap = new Map();

      allPinNames.forEach(pin => {
        let root = ds.find(pin);
        if (!rootsMap.has(root)) {
          rootsMap.set(root, { hasPWR: false, hasGND: false, hasOUT: false, activeOuts: new Set() });
        }
      });

      allPinNames.forEach(pin => {
        let [cId, pId] = pin.split(":");
        let root = ds.find(pin);
        let info = rootsMap.get(root);
        if (cId === "LMU") {
          if (pId === "PWR") info.hasPWR = true;
          if (pId === "GND") info.hasGND = true;
          if (pId.startsWith("OUT")) {
            let idx = parseInt(pId.replace("OUT", ""));
            if (lmuOutputs[idx]) {
              info.hasOUT = true;
              info.activeOuts.add(idx);
            }
          }
        }
      });

      components.forEach(comp => {
        if (comp.type !== 'relay') return;
        let rId = comp.id;
        let coil85 = ds.find(`${rId}:85`);
        let coil86 = ds.find(`${rId}:86`);
        if (coil85 === coil86) return;
        let info85 = rootsMap.get(coil85);
        let info86 = rootsMap.get(coil86);
        if (!info85 || !info86) return;

        let energized = (info85.hasPWR || info85.hasOUT) && info86.hasGND || 
                        (info86.hasPWR || info86.hasOUT) && info85.hasGND;

        let currentActive = relayStates.get(rId) === '87';
        if (energized !== currentActive) {
          relayStates.set(rId, energized ? '87' : '87a');
        }
      });

      let topologyChanged = false;
      components.forEach(comp => {
        if (comp.type !== 'relay') return;
        let rId = comp.id;
        let activeContact = relayStates.get(rId) || '87a';
        let pin30 = `${rId}:30`;
        let pinContact = `${rId}:${activeContact}`;
        if (ds.parent.has(pin30) && ds.parent.has(pinContact)) {
          if (ds.union(pin30, pinContact)) {
            topologyChanged = true;
          }
        }
      });

      if (!topologyChanged && iterations > 1) {
        converged = true;
      }
    }

    let finalRootsMap = new Map();
    allPinNames.forEach(pin => {
      let root = ds.find(pin);
      if (!finalRootsMap.has(root)) {
        finalRootsMap.set(root, { hasPWR: false, hasGND: false, hasOUT: false });
      }
    });

    allPinNames.forEach(pin => {
      let [cId, pId] = pin.split(":");
      let root = ds.find(pin);
      let info = finalRootsMap.get(root);
      if (cId === "LMU") {
        if (pId === "PWR") info.hasPWR = true;
        if (pId === "GND") info.hasGND = true;
        if (pId.startsWith("OUT")) {
          let idx = parseInt(pId.replace("OUT", ""));
          if (lmuOutputs[idx]) info.hasOUT = true;
        }
      }
    });

    let nodeStateMap = new Map();
    allPinNames.forEach(pin => {
      let root = ds.find(pin);
      let info = finalRootsMap.get(root);
      if (info.hasPWR) nodeStateMap.set(pin, "PWR");
      else if (info.hasOUT) nodeStateMap.set(pin, "ACTIVE");
      else if (info.hasGND) nodeStateMap.set(pin, "GND");
      else nodeStateMap.set(pin, "FLOAT");
    });

    let energizedRelays = new Set();
    let energizedLamps = new Set();

    components.forEach(comp => {
      if (comp.type === 'relay') {
        let rId = comp.id;
        let c85 = nodeStateMap.get(`${rId}:85`);
        let c86 = nodeStateMap.get(`${rId}:86`);
        if ((c85 === 'PWR' || c85 === 'ACTIVE') && c86 === 'GND' || (c86 === 'PWR' || c86 === 'ACTIVE') && c85 === 'GND') {
          energizedRelays.add(rId);
        }
      } else if (comp.type === 'lamp') {
        let lId = comp.id;
        let cA = nodeStateMap.get(`${lId}:A`);
        let cB = nodeStateMap.get(`${lId}:B`);
        if ((cA === 'PWR' || cA === 'ACTIVE') && cB === 'GND' || (cB === 'PWR' || cB === 'ACTIVE') && cA === 'GND') {
          energizedLamps.add(lId);
        }
      }
    });

    let activeWires = new Set();
    wires.forEach(w => {
      let pinA = `${w.a.cId}:${w.a.pinId}`;
      let stateA = nodeStateMap.get(pinA);
      if (stateA === 'PWR' || stateA === 'ACTIVE') {
        activeWires.add(w.id);
      }
    });

    setAnalysisResult({
      nodeState: nodeStateMap,
      energized: energizedRelays,
      lampOn: energizedLamps,
      activeWires: activeWires
    });

  }, [components, wires, lmuOutputs]);

  const handleSendToGemini = async (customPrompt = null) => {
    const promptText = customPrompt || chatInput;
    if (!promptText.trim()) return;

    const userMsg = { role: 'user', text: promptText };
    setChatMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setChatInput('');
    setIsAiLoading(true);

    try {
      // Compilar resumen del estado actual del circuito para contextualizar a la IA
      const circuitSummary = {
        components: components.map(c => ({ id: c.id, type: c.type })),
        wiresCount: wires.length,
        lmuOutputsActive: lmuOutputs.map((v, i) => `OUT${i}: ${v}`).join(', '),
        energizedRelays: Array.from(analysisResult?.energized || []),
        activeLamps: Array.from(analysisResult?.lampOn || [])
      };

      const systemPrompt = `Actúa como un ingeniero electrónico experto en telemetría vehicular y arquitecturas de hardware CalAmp LMU-2630. Analiza el siguiente estado del circuito: ${JSON.stringify(circuitSummary)}. Proporciona respuestas técnicas precisas, concisas y directas en español.`;
      
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nConsulta del operador: ${promptText}` }] }
        ]
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const candidate = result.candidates?.[0];
      const modelReply = candidate?.content?.parts?.[0]?.text || "No se pudo obtener respuesta del modelo en este momento.";

      setChatMessages(prev => [...prev, { role: 'model', text: modelReply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: '⚠️ Error de comunicación con la API de Gemini. Verifique su conexión.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const drawGridAndWires = useCallback((progress) => {
    const canvasWires = canvasWiresRef.current;
    const canvasBg = canvasBgRef.current;
    if (!canvasWires || !canvasBg) return;

    const ctxWires = canvasWires.getContext('2d');
    const ctxBg = canvasBg.getContext('2d');
    const width = canvasWires.clientWidth;
    const height = canvasWires.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (canvasWires.width !== width * dpr) {
      canvasWires.width = width * dpr;
      canvasWires.height = height * dpr;
      canvasBg.width = width * dpr;
      canvasBg.height = height * dpr;
    }

    ctxBg.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxBg.clearRect(0, 0, width, height);
    ctxBg.fillStyle = '#0f172a';
    ctxBg.fillRect(0, 0, width, height);

    ctxBg.strokeStyle = '#1e293b';
    ctxBg.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < width; x += gridSize) {
      ctxBg.beginPath(); ctxBg.moveTo(x, 0); ctxBg.lineTo(x, height); ctxBg.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctxBg.beginPath(); ctxBg.moveTo(0, y); ctxBg.lineTo(width, y); ctxBg.stroke();
    }

    ctxWires.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxWires.clearRect(0, 0, width, height);

    wires.forEach(w => {
      const ptA = getPinAbsoluteCoords(w.a.cId, w.a.pinId);
      const ptB = getPinAbsoluteCoords(w.b.cId, w.b.pinId);
      const pinKey = `${w.a.cId}:${w.a.pinId}`;
      const state = analysisResult?.nodeState?.get(pinKey) || 'FLOAT';

      let strokeColor = '#475569';
      if (state === 'PWR') strokeColor = '#ef4444';
      else if (state === 'ACTIVE') strokeColor = '#38bdf8';
      else if (state === 'GND') strokeColor = '#10b981';

      const dx = ptB.x - ptA.x;
      const dy = ptB.y - ptA.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const curvature = 35 + dist * 0.15;
      const cp1 = { x: ptA.x + dx * 0.25 + nx * curvature, y: ptA.y + dy * 0.25 + ny * curvature };
      const cp2 = { x: ptA.x + dx * 0.75 + nx * curvature, y: ptA.y + dy * 0.75 + ny * curvature };

      ctxWires.beginPath();
      ctxWires.moveTo(ptA.x, ptA.y);
      ctxWires.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, ptB.x, ptB.y);
      ctxWires.strokeStyle = strokeColor;
      ctxWires.lineWidth = w.id === selectedWireId ? 3.5 : 2.2;
      ctxWires.lineCap = 'round';
      ctxWires.stroke();

      if (analysisResult?.activeWires?.has(w.id)) {
        const t = progress;
        const bx = Math.pow(1 - t, 3) * ptA.x + 3 * Math.pow(1 - t, 2) * t * cp1.x + 3 * (1 - t) * t * t * cp2.x + t * t * t * ptB.x;
        const by = Math.pow(1 - t, 3) * ptA.y + 3 * Math.pow(1 - t, 2) * t * cp1.y + 3 * (1 - t) * t * t * cp2.y + t * t * t * ptB.y;

        ctxWires.beginPath();
        ctxWires.arc(bx, by, 3, 0, Math.PI * 2);
        ctxWires.fillStyle = '#ffffff';
        ctxWires.fill();

        ctxWires.beginPath();
        ctxWires.arc(bx, by, 6, 0, Math.PI * 2);
        ctxWires.fillStyle = 'rgba(56, 189, 248, 0.3)';
        ctxWires.fill();
      }
    });

  }, [wires, analysisResult, selectedWireId, getPinAbsoluteCoords]);

  useEffect(() => {
    const loop = (time) => {
      animProgressRef.current = (animProgressRef.current + 0.025) % 1;
      drawGridAndWires(animProgressRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawGridAndWires]);

  const draggingRef = useRef(null);

  const handlePointerDownComponent = (e, compId) => {
    if (e.target.closest('[data-pin]') || e.target.closest('button')) return;
    const comp = components.find(c => c.id === compId);
    if (!comp) return;

    draggingRef.current = {
      id: compId,
      startX: e.clientX,
      startY: e.clientY,
      origX: comp.x,
      origY: comp.y,
      el: e.currentTarget
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMoveComponent = (e) => {
    if (!draggingRef.current) return;
    const d = draggingRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const newX = Math.round((d.origX + dx) / 12) * 12;
    const newY = Math.round((d.origY + dy) / 12) * 12;

    d.el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
    compPositionsRef.current.set(d.id, { x: newX, y: newY });
    drawGridAndWires(animProgressRef.current);
  };

  const handlePointerUpComponent = (e) => {
    if (!draggingRef.current) return;
    const d = draggingRef.current;
    try { d.el.releasePointerCapture(e.pointerId); } catch {}

    const wsRect = workspaceRef.current.getBoundingClientRect();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const finalX = Math.max(0, Math.min(wsRect.width - 100, Math.round((d.origX + dx) / 12) * 12));
    const finalY = Math.max(0, Math.min(wsRect.height - 100, Math.round((d.origY + dy) / 12) * 12));

    d.el.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
    compPositionsRef.current.set(d.id, { x: finalX, y: finalY });
    
    setComponents(prev => prev.map(c => c.id === d.id ? { ...c, x: finalX, y: finalY } : c));
    draggingRef.current = null;
  };

  const handlePinClick = (cId, pinId, e) => {
    e.stopPropagation();
    try { navigator.vibrate?.(15); } catch {}

    if (!connectingPin) {
      setConnectingPin({ cId, pinId });
    } else {
      if (connectingPin.cId === cId && connectingPin.pinId === pinId) {
        setConnectingPin(null);
        return;
      }
      const exists = wires.some(w => 
        (w.a.cId === connectingPin.cId && w.a.pinId === connectingPin.pinId && w.b.cId === cId && w.b.pinId === pinId) ||
        (w.b.cId === connectingPin.cId && w.b.pinId === connectingPin.pinId && w.a.cId === cId && w.a.pinId === pinId)
      );

      if (!exists) {
        const newWire = {
          id: `W_${Date.now()}`,
          a: connectingPin,
          b: { cId, pinId }
        };
        setWires(prev => [...prev, newWire]);
      }
      setConnectingPin(null);
    }
  };

  const handleWorkspaceClick = (e) => {
    if (connectingPin) setConnectingPin(null);
    const wsRect = workspaceRef.current.getBoundingClientRect();
    const clickX = e.clientX - wsRect.left;
    const clickY = e.clientY - wsRect.top;

    let foundWire = null;
    let minDst = 20;

    wires.forEach(w => {
      const ptA = getPinAbsoluteCoords(w.a.cId, w.a.pinId);
      const ptB = getPinAbsoluteCoords(w.b.cId, w.b.pinId);
      const midX = (ptA.x + ptB.x) / 2;
      const midY = (ptA.y + ptB.y) / 2;
      const dst = Math.hypot(midX - clickX, midY - clickY);
      if (dst < minDst) {
        minDst = dst;
        foundWire = w;
      }
    });

    if (foundWire) {
      setSelectedWireId(foundWire.id);
      const ptA = getPinAbsoluteCoords(foundWire.a.cId, foundWire.a.pinId);
      const ptB = getPinAbsoluteCoords(foundWire.b.cId, foundWire.b.pinId);
      setSelectedWireCenter({ x: (ptA.x + ptB.x) / 2, y: (ptA.y + ptB.y) / 2 });
    } else {
      setSelectedWireId(null);
      setSelectedWireCenter(null);
    }
  };

  const addRelay = () => {
    try { navigator.vibrate?.(10); } catch {}
    const newId = `R${nextId}`;
    setNextId(prev => prev + 1);
    setComponents(prev => [...prev, { id: newId, type: 'relay', x: 80 + Math.random() * 120, y: 180 + Math.random() * 80 }]);
  };

  const addLamp = () => {
    try { navigator.vibrate?.(10); } catch {}
    const newId = `L${nextId}`;
    setNextId(prev => prev + 1);
    setComponents(prev => [...prev, { id: newId, type: 'lamp', x: 220 + Math.random() * 120, y: 200 + Math.random() * 80 }]);
  };

  const resetCircuit = () => {
    try { navigator.vibrate?.(20); } catch {}
    const def = getDefaultCircuit();
    setComponents(def.comps);
    setWires(def.wires);
    setLmuOutputs(def.outs);
    setConnectingPin(null);
    setSelectedWireId(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* HEADER MINIMALISTA TIPO INSTRUMENTO */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 z-30 shrink-0 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h1 className="text-xs font-mono font-bold tracking-wider text-cyan-400">LMU-2630 <span className="text-slate-400 font-normal">HMI PRO + GEMINI</span></h1>
        </div>

        {/* Toggles de Salida Rápida LMU */}
        <div className="flex items-center space-x-1.5">
          {lmuOutputs.map((active, idx) => (
            <button
              key={idx}
              onClick={() => {
                try { navigator.vibrate?.(10); } catch {}
                setLmuOutputs(prev => {
                  let next = [...prev];
                  next[idx] = !next[idx];
                  return next;
                });
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-all ${
                active 
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              OUT{idx}
            </button>
          ))}
        </div>
      </header>

      {/* CUERPO PRINCIPAL / PESTAÑAS */}
      <main className="flex-1 flex flex-col relative overflow-hidden pb-16">
        
        {/* VISTA 1: TABLERO DE CIRCUITO FÍSICO */}
        {activeTab === 'board' && (
          <div 
            ref={workspaceRef}
            onClick={handleWorkspaceClick}
            className="flex-1 relative overflow-hidden bg-slate-950 cursor-crosshair touch-none"
          >
            <canvas ref={canvasBgRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            <canvas ref={canvasWiresRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {components.map(comp => {
              const pos = compPositionsRef.current.get(comp.id) || { x: comp.x, y: comp.y };
              const isRelay = comp.type === 'relay';
              const isLamp = comp.type === 'lamp';
              const isLmu = comp.type === 'lmu';

              const energizedRelay = isRelay && analysisResult?.energized?.has(comp.id);
              const lampOn = isLamp && analysisResult?.lampOn?.has(comp.id);

              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handlePointerDownComponent(e, comp.id)}
                  onPointerMove={handlePointerMoveComponent}
                  onPointerUp={handlePointerUpComponent}
                  className="absolute cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{
                    transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                    width: COMP_SIZES[comp.type].w,
                    height: COMP_SIZES[comp.type].h,
                    zIndex: 10
                  }}
                >
                  {isLmu && (
                    <div className="w-full h-full bg-[#0a2e21] border border-[#10b981]/40 rounded-xl p-3 shadow-2xl relative flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">LMU-2630 EDGE</span>
                        <span className="text-[9px] font-mono text-slate-400">12V ECU</span>
                      </div>
                      <div className="bg-slate-950/80 rounded-lg p-2 border border-emerald-900/50 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
                          <span className="text-[9px] text-slate-300 font-mono">PWR BUS</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[9px] text-slate-300 font-mono">GND</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {isRelay && (
                    <div className={`w-full h-full bg-slate-900 border rounded-xl p-2.5 shadow-xl flex flex-col justify-between transition-colors ${
                      energizedRelay ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-slate-700'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-bold text-slate-300">{comp.id}</span>
                        <div className={`w-2 h-2 rounded-full ${energizedRelay ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'}`} />
                      </div>
                      <div className="bg-slate-950 rounded-lg h-8 flex items-center justify-center border border-slate-800">
                        <span className="text-[9px] font-mono text-slate-400">{energizedRelay ? 'SPDT: NO Closed' : 'SPDT: NC Closed'}</span>
                      </div>
                    </div>
                  )}

                  {isLamp && (
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                        lampOn 
                          ? 'bg-amber-200 border-amber-400 shadow-[0_0_25px_#fde047,inset_0_0_10px_#ca8a04]' 
                          : 'bg-slate-900 border-slate-700 shadow-md'
                      }`}>
                        <span className="text-lg">💡</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 mt-1">{comp.id}</span>
                    </div>
                  )}

                  {(isLmu ? LMU_PINS : COMP_PINS[comp.type]).map(pin => {
                    const pinKey = `${comp.id}:${pin.id}`;
                    const state = analysisResult?.nodeState?.get(pinKey) || 'FLOAT';
                    const isSelected = connectingPin?.cId === comp.id && connectingPin?.pinId === pin.id;
                    const offset = PIN_OFFSETS[comp.type][pin.id];

                    let pinBg = '#334155';
                    if (state === 'PWR') pinBg = '#ef4444';
                    else if (state === 'ACTIVE') pinBg = '#38bdf8';
                    else if (state === 'GND') pinBg = '#10b981';

                    return (
                      <div
                        key={pin.id}
                        onClick={(e) => handlePinClick(comp.id, pin.id, e)}
                        className={`absolute w-5 h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-transform z-20 ${
                          isSelected ? 'scale-125 border-white shadow-[0_0_12px_#fff]' : 'border-slate-900 hover:scale-110'
                        }`}
                        style={{
                          left: offset.x,
                          top: offset.y,
                          backgroundColor: pinBg,
                          boxShadow: state !== 'FLOAT' ? `0 0 8px ${pinBg}` : 'none'
                        }}
                        title={`${comp.id}:${pin.id} (${pin.label})`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {selectedWireId && selectedWireCenter && (
              <button
                onClick={() => {
                  setWires(prev => prev.filter(w => w.id !== selectedWireId));
                  setSelectedWireId(null);
                  setSelectedWireCenter(null);
                }}
                className="absolute bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-full shadow-2xl z-40 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-xs font-bold"
                style={{ left: selectedWireCenter.x, top: selectedWireCenter.y }}
                title="Eliminar Cable"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {connectingPin && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 px-3 py-1.5 rounded-full text-xs font-mono shadow-lg z-30 animate-pulse">
                Conectando {connectingPin.cId}:{connectingPin.pinId} — Toca otro pin destino
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: TELEMETRÍA Y ESTADO DEL SISTEMA */}
        {activeTab === 'telemetry' && (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-950">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center">
                <Activity className="w-4 h-4 mr-1.5" /> Estado de Canales LMU-2630
              </h2>

              <div className="grid grid-cols-3 gap-2">
                {lmuOutputs.map((state, i) => (
                  <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">OUT-{i}</span>
                    <span className={`text-sm font-bold font-mono mt-1 ${state ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {state ? 'ACTIVO (GND)' : 'ABIERTO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center">
                <Cpu className="w-4 h-4 mr-1.5" /> Diagnóstico de Hardware Embebido
              </h2>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Temperatura MCU</span>
                  <span className="text-emerald-400">41.8 °C (Normal)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Consumo Línea 12V</span>
                  <span className="text-cyan-400">145 mA</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Estado Watchdog</span>
                  <span className="text-emerald-400">OK (Activo)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 3: ASISTENTE TÉCNICO CON GEMINI API */}
        {activeTab === 'ai' && (
          <div className="flex-1 flex flex-col p-4 bg-slate-950 overflow-hidden">
            <div className="bg-purple-950/20 border border-purple-500/30 p-3 rounded-xl mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" /> Asistente Arquitecto Gemini API
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Analiza el circuito activo ({components.length} componentes, {wires.length} conexiones).
                </p>
              </div>
              <button 
                onClick={() => handleSendToGemini("Analiza mi circuito actual, verifica si hay errores de conexión o cortos posibles, y dame recomendaciones.")}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-md"
              >
                <Cpu className="w-3.5 h-3.5" /> Diagnosticar
              </button>
            </div>

            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-y-auto space-y-3 text-xs font-mono">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 rounded-br-none' 
                      : 'bg-purple-950/40 border border-purple-500/30 text-purple-200 rounded-bl-none'
                  }`}>
                    <div className="text-[9px] opacity-70 mb-1 font-bold">{msg.role === 'user' ? 'Operador' : 'Gemini AI'}</div>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex items-center space-x-2 text-purple-400 p-2 animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Gemini está analizando la topología eléctrica...</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendToGemini()}
                placeholder="Pregunta a Gemini sobre tu circuito o pide optimizaciones..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button 
                onClick={() => handleSendToGemini()}
                disabled={isAiLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR Y HERRAMIENTAS MÓVILES */}
      <nav className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex justify-around items-center px-2 z-40 shadow-2xl">
        {activeTab === 'board' && (
          <>
            <button 
              onClick={addRelay}
              className="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-cyan-400 active:scale-95 transition-colors"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-mono mt-0.5">Relé</span>
            </button>
            <button 
              onClick={addLamp}
              className="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-cyan-400 active:scale-95 transition-colors"
            >
              <Plus className="w-4 h-4 text-yellow-400" />
              <span className="text-[10px] font-mono mt-0.5">Lámpara</span>
            </button>
            <button 
              onClick={resetCircuit}
              className="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-rose-400 active:scale-95 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] font-mono mt-0.5">Reiniciar</span>
            </button>
          </>
        )}

        <div className="w-[1px] h-8 bg-slate-800 mx-1" />

        <button 
          onClick={() => setActiveTab('board')}
          className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'board' ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px] font-mono mt-0.5">Tablero</span>
        </button>

        <button 
          onClick={() => setActiveTab('telemetry')}
          className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'telemetry' ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[10px] font-mono mt-0.5">Sensores</span>
        </button>

        <button 
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center justify-center flex-1 h-full ${activeTab === 'ai' ? 'text-purple-400 font-bold' : 'text-slate-500'}`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-mono mt-0.5">IA Gemini</span>
        </button>
      </nav>

    </div>
  );
}