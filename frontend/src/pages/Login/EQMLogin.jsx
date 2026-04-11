import { useEffect, useRef, useState } from "react";

import { APP_VERSION } from "../../appVersion";

const DEFAULTS = {
  version: APP_VERSION,
  sessionExpired: false
};

const ROWS = {
  R6: { y: 166, cy: 177 },
  R7: { y: 214, cy: 225 },
  R8: { y: 240, cy: 251 },
  R9: { y: 266, cy: 277 },
  R10: { y: 292, cy: 303 },
  R11: { y: 318, cy: 329 }
};

const MISSIONS = [
  { srcRow: "R6", srcBay: 0, dstRow: "R7", dstBay: 8 },
  { srcRow: "R7", srcBay: 1, dstRow: "R8", dstBay: 1 },
  { srcRow: "R8", srcBay: 2, dstRow: "R9", dstBay: 2 },
  { srcRow: "R9", srcBay: 3, dstRow: "R10", dstBay: 3 },
  { srcRow: "R10", srcBay: 4, dstRow: "R11", dstBay: 4 },
  { srcRow: "R11", srcBay: 5, dstRow: "R7", dstBay: 5 },
  { srcRow: "R7", srcBay: 6, dstRow: "R8", dstBay: 6 },
  { srcRow: "R8", srcBay: 7, dstRow: "R9", dstBay: 7 }
];

const BAY_X = (i) => 56 + i * 21;
const AISLE_Y = 201;
const FK_W = 14;

const ease = (t) => (t < 0.5 ? 2 * t * t : (4 - 2 * t) * t - 1);

const useForklift = (svgRef) => {
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return undefined;
    }

    const fkBody = svg.getElementById("fkBody");
    const fkMast = svg.getElementById("fkMast");
    const fkF1 = svg.getElementById("fkF1");
    const fkF2 = svg.getElementById("fkF2");
    const fkCargo = svg.getElementById("fkCargo");
    const srcCell = svg.getElementById("srcCell");
    const dstCell = svg.getElementById("dstCell");

    if (!fkBody || !fkMast || !fkF1 || !fkF2 || !fkCargo || !srcCell || !dstCell) {
      return undefined;
    }

    let rafId = null;
    let timeoutId = null;
    let cancelled = false;
    let currentPos = { x: 56, y: AISLE_Y - 5 };

    const setPos = (bx, by) => {
      currentPos = { x: bx, y: by };
      fkBody.setAttribute("x", `${bx}`);
      fkBody.setAttribute("y", `${by}`);
      fkMast.setAttribute("x", `${bx + FK_W}`);
      fkMast.setAttribute("y", `${by - 3}`);
      fkF1.setAttribute("x1", `${bx + FK_W + 3}`);
      fkF1.setAttribute("x2", `${bx + FK_W + 11}`);
      fkF1.setAttribute("y1", `${by + 2}`);
      fkF1.setAttribute("y2", `${by + 2}`);
      fkF2.setAttribute("x1", `${bx + FK_W + 3}`);
      fkF2.setAttribute("x2", `${bx + FK_W + 11}`);
      fkF2.setAttribute("y1", `${by + 6}`);
      fkF2.setAttribute("y2", `${by + 6}`);
      fkCargo.setAttribute("x", `${bx + FK_W + 2}`);
      fkCargo.setAttribute("y", `${by - 1}`);
    };

    const moveTo = (tx, ty, duration, onDone) => {
      const startX = currentPos.x;
      const startY = currentPos.y;
      const startTime = performance.now();

      const step = (now) => {
        if (cancelled) {
          return;
        }
        const t = Math.min((now - startTime) / duration, 1);
        const eased = ease(t);
        const nx = startX + (tx - startX) * eased;
        const ny = startY + (ty - startY) * eased;
        setPos(nx, ny);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else if (onDone) {
          onDone();
        }
      };

      rafId = requestAnimationFrame(step);
    };

    const wait = (ms, cb) => {
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          cb();
        }
      }, ms);
    };

    const runMission = (index) => {
      if (cancelled) {
        return;
      }
      const mission = MISSIONS[index];
      const src = ROWS[mission.srcRow];
      const dst = ROWS[mission.dstRow];
      const srcBx = BAY_X(mission.srcBay);
      const dstBx = BAY_X(mission.dstBay);

      srcCell.setAttribute("x", `${srcBx}`);
      srcCell.setAttribute("y", `${src.y}`);
      srcCell.setAttribute("opacity", "1");
      dstCell.setAttribute("x", `${dstBx}`);
      dstCell.setAttribute("y", `${dst.y}`);
      dstCell.setAttribute("opacity", "1");

      moveTo(srcBx - FK_W, AISLE_Y - 5, 900, () => {
        const srcAbove = src.y < 192;
        const rowY = src.cy - 5 + (srcAbove ? -3 : 3);
        moveTo(srcBx - FK_W, rowY, 500, () => {
          fkCargo.setAttribute("opacity", "1");
          srcCell.setAttribute("opacity", "0");
          wait(300, () => {
            moveTo(srcBx - FK_W, AISLE_Y - 5, 500, () => {
              moveTo(dstBx - FK_W, AISLE_Y - 5, 900, () => {
                const dstAbove = dst.y < 192;
                const dstRowY = dst.cy - 5 + (dstAbove ? -3 : 3);
                moveTo(dstBx - FK_W, dstRowY, 500, () => {
                  fkCargo.setAttribute("opacity", "0");
                  dstCell.setAttribute("opacity", "0");
                  wait(300, () => {
                    moveTo(dstBx - FK_W, AISLE_Y - 5, 500, () => {
                      wait(400, () => {
                        const next = (index + 1) % MISSIONS.length;
                        runMission(next);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    };

    setPos(56, AISLE_Y - 5);
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        runMission(0);
      }
    }, 800);

    return () => {
      cancelled = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [svgRef]);
};

const WarehouseSVG = ({ svgRef }) => {
  return (
    <svg ref={svgRef} className="eqm-wh-svg" viewBox="0 0 320 440" aria-hidden="true">
      <rect x="1" y="1" width="318" height="438" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      <rect x="7" y="7" width="306" height="426" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="0.5" />

      <rect x="7" y="406" width="306" height="27" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="110" y1="406" x2="110" y2="433" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="220" y1="406" x2="220" y2="433" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="7" y1="417" x2="313" y2="417" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="11" y="414" fontSize="5.5" fill="rgba(255,255,255,.22)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        ОБЪЕКТ
      </text>
      <text x="114" y="414" fontSize="5.5" fill="rgba(255,255,255,.22)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        МАСШТАБ
      </text>
      <text x="224" y="414" fontSize="5.5" fill="rgba(255,255,255,.22)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        ЛИСТ
      </text>
      <text x="11" y="428" fontSize="7" fill="rgba(255,255,255,.4)" fontFamily="JetBrains Mono, monospace">
        Склад WH-01
      </text>
      <text x="114" y="428" fontSize="7" fill="rgba(255,255,255,.4)" fontFamily="JetBrains Mono, monospace">
        1:200
      </text>
      <text x="224" y="428" fontSize="7" fill="rgba(255,255,255,.4)" fontFamily="JetBrains Mono, monospace">
        1/2
      </text>
      <text
        x="309"
        y="428"
        textAnchor="end"
        fontSize="6"
        fill="rgba(217,119,6,.45)"
        fontFamily="JetBrains Mono, monospace"
      >
        WH-01
      </text>

      <rect x="279" y="7" width="34" height="40" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="296" y="17" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
        REV
      </text>
      <line x1="279" y1="20" x2="313" y2="20" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="296" y="32" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        A
      </text>
      <text x="296" y="42" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,.35)" fontFamily="JetBrains Mono, monospace">
        INITIAL
      </text>

      <rect x="7" y="7" width="52" height="20" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="11" y="14" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
        МАСШТАБ
      </text>
      <text x="11" y="22" fontSize="6.5" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        1:200
      </text>

      <rect x="10" y="30" width="286" height="372" rx="1" fill="rgba(255,255,255,.01)" stroke="rgba(255,255,255,.32)" strokeWidth="1.8" />
      <line x1="52" y1="32" x2="52" y2="398" stroke="rgba(255,255,255,.18)" strokeWidth="0.8" />
      <line x1="246" y1="32" x2="246" y2="398" stroke="rgba(255,255,255,.18)" strokeWidth="0.8" />
      <line x1="270" y1="32" x2="270" y2="398" stroke="rgba(217,119,6,.28)" strokeWidth="0.8" />
      <line x1="12" y1="72" x2="52" y2="72" stroke="rgba(255,255,255,.15)" strokeWidth="0.7" />
      <line x1="34" y1="32" x2="34" y2="72" stroke="rgba(255,255,255,.12)" strokeWidth="0.5" />

      <rect x="12" y="32" width="22" height="40" fill="rgba(255,255,255,.025)" />
      <text x="23" y="50" textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,.28)" fontFamily="JetBrains Mono, monospace">
        Офис
      </text>
      <rect x="15" y="54" width="8" height="5" fill="rgba(255,255,255,.08)" />
      <rect x="25" y="54" width="8" height="5" fill="rgba(255,255,255,.08)" />

      <rect x="34" y="32" width="18" height="40" fill="rgba(255,255,255,.015)" />
      <text x="43" y="50" textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,.28)" fontFamily="JetBrains Mono, monospace">
        WC
      </text>

      <text x="32" y="246" fontSize="6" fill="rgba(255,255,255,.2)" fontFamily="JetBrains Mono, monospace">
        Зона А
      </text>
      <text x="258" y="206" fontSize="5.5" fill="rgba(255,255,255,.18)" fontFamily="JetBrains Mono, monospace">
        Зона В
      </text>

      <rect x="270" y="32" width="20" height="366" fill="rgba(217,119,6,.025)" />
      {[
        { y: 44, label: "Д1" },
        { y: 80, label: "Д2" },
        { y: 116, label: "Д3" },
        { y: 152, label: "Д4" }
      ].map((dock) => (
        <g key={dock.label}>
          <rect x="272" y={dock.y} width="16" height="26" fill="rgba(217,119,6,.05)" stroke="rgba(217,119,6,.22)" strokeWidth="0.6" />
          <rect x="275" y={dock.y + 9} width="10" height="8" fill="rgba(217,119,6,.12)" />
          <text x="280" y={dock.y + 18} textAnchor="middle" fontSize="5" fill="rgba(217,119,6,.4)" fontFamily="JetBrains Mono, monospace">
            {dock.label}
          </text>
        </g>
      ))}

      <g>
        {[36, 62, 88, 114, 140, 166].map((y, idx) => (
          <rect key={`r${idx + 1}`} x="56" y={y} width="186" height="22" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.15)" strokeWidth="0.6" />
        ))}
        <text x="50" y="49" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R1
        </text>
        <text x="50" y="75" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R2
        </text>
        <text x="50" y="101" textAnchor="end" fontSize="5.5" fill="rgba(217,119,6,.55)" fontFamily="JetBrains Mono, monospace">
          R3
        </text>
        <text x="50" y="127" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R4
        </text>
        <text x="50" y="153" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R5
        </text>
        <text x="50" y="179" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R6
        </text>
        {[77, 98, 119, 140, 161, 182, 203, 224].map((x) => (
          <line key={`cu-${x}`} x1={x} y1="36" x2={x} y2="188" stroke="rgba(255,255,255,.1)" strokeWidth="0.5" />
        ))}
      </g>

      <rect x="56" y="192" width="186" height="18" fill="rgba(217,119,6,.025)" />
      <line x1="56" y1="201" x2="242" y2="201" stroke="rgba(217,119,6,.12)" strokeWidth="0.6" strokeDasharray="6 3" />

      <g>
        {[214, 240, 266, 292, 318].map((y, idx) => (
          <rect key={`r${idx + 7}`} x="56" y={y} width="186" height="22" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.15)" strokeWidth="0.6" />
        ))}
        <text x="50" y="227" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R7
        </text>
        <text x="50" y="253" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R8
        </text>
        <text x="50" y="279" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R9
        </text>
        <text x="50" y="305" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R10
        </text>
        <text x="50" y="331" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
          R11
        </text>
        {[77, 98, 119, 140, 161, 182, 203, 224].map((x) => (
          <line key={`cl-${x}`} x1={x} y1="214" x2={x} y2="340" stroke="rgba(255,255,255,.1)" strokeWidth="0.5" />
        ))}
      </g>

      <rect x="140" y="88" width="21" height="22" fill="rgba(217,119,6,.4)" stroke="rgba(217,119,6,.65)" strokeWidth="0.5" className="eqm-cell-p" />
      <circle cx="150" cy="99" r="5" fill="none" stroke="rgba(217,119,6,.7)" strokeWidth="0.7" className="eqm-scan-r" />
      <line x1="150" y1="88" x2="180" y2="72" stroke="rgba(255,255,255,.25)" strokeDasharray="4 3" />
      <text x="184" y="70" fontSize="6" fill="rgba(255,255,255,.3)" fontFamily="JetBrains Mono, monospace">
        E-R3
      </text>

      <line x1="155" y1="398" x2="155" y2="382" stroke="rgba(217,119,6,.5)" strokeWidth="1" />
      <line x1="150" y1="386" x2="155" y2="382" stroke="rgba(217,119,6,.5)" strokeWidth="1" />
      <line x1="160" y1="386" x2="155" y2="382" stroke="rgba(217,119,6,.5)" strokeWidth="1" />

      <line x1="10" y1="390" x2="296" y2="390" stroke="rgba(255,255,255,.25)" strokeWidth="0.6" />
      <line x1="10" y1="386" x2="10" y2="394" stroke="rgba(255,255,255,.25)" strokeWidth="0.6" />
      <line x1="296" y1="386" x2="296" y2="394" stroke="rgba(255,255,255,.25)" strokeWidth="0.6" />
      <text x="151" y="401" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,.35)" fontFamily="JetBrains Mono, monospace">
        75.0 м
      </text>

      <g id="fk">
        <rect id="fkBody" x="56" y="196" width="14" height="10" rx="1" fill="rgba(217,119,6,.5)" />
        <rect id="fkMast" x="70" y="193" width="3" height="16" rx="0.5" fill="rgba(217,119,6,.4)" />
        <line id="fkF1" x1="73" y1="198" x2="81" y2="198" stroke="rgba(217,119,6,.55)" strokeWidth="1" />
        <line id="fkF2" x1="73" y1="202" x2="81" y2="202" stroke="rgba(217,119,6,.55)" strokeWidth="1" />
        <rect id="fkCargo" x="72" y="195" width="9" height="7" rx="1" fill="rgba(255,180,60,.5)" opacity="0" />
      </g>

      <rect id="srcCell" x="56" y="166" width="21" height="22" fill="rgba(217,119,6,.15)" opacity="0" />
      <rect id="dstCell" x="56" y="214" width="21" height="22" fill="rgba(80,200,80,.1)" opacity="0" />
    </svg>
  );
};

const PIDSVG = () => {
  return (
    <svg className="eqm-pid-svg" viewBox="0 0 440 530" aria-hidden="true">
      <defs>
        <marker id="pa1" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M1 1L7 4L1 7" fill="none" stroke="rgba(217,119,6,.6)" strokeWidth="1.5" strokeLinecap="round" />
        </marker>
        <marker id="pa2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M1 1L7 4L1 7" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" strokeLinecap="round" />
        </marker>
      </defs>

      <rect x="1" y="1" width="438" height="528" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      <rect x="8" y="8" width="424" height="467" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="0.5" />

      <rect x="8" y="475" width="424" height="53" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="160" y1="475" x2="160" y2="528" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="290" y1="475" x2="290" y2="528" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="370" y1="475" x2="370" y2="528" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <line x1="8" y1="497" x2="432" y2="497" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="12" y="491" fontSize="6" fill="rgba(255,255,255,.25)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        РАЗРАБОТАЛ
      </text>
      <text x="164" y="491" fontSize="6" fill="rgba(255,255,255,.25)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        ОБЪЕКТ
      </text>
      <text x="294" y="491" fontSize="6" fill="rgba(255,255,255,.25)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        ДАТА
      </text>
      <text x="374" y="491" fontSize="6" fill="rgba(255,255,255,.25)" letterSpacing="1" fontFamily="JetBrains Mono, monospace">
        ЛИСТ
      </text>
      <text x="12" y="516" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        EQM Engineering
      </text>
      <text x="164" y="516" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        Насосный контур
      </text>
      <text x="294" y="516" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        2025-04
      </text>
      <text x="374" y="516" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        2/2
      </text>
      <text x="428" y="516" textAnchor="end" fontSize="7" fill="rgba(217,119,6,.5)" fontFamily="JetBrains Mono, monospace">
        PID-001
      </text>

      <rect x="388" y="8" width="44" height="55" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="410" y="20" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
        REV
      </text>
      <line x1="388" y1="23" x2="432" y2="23" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="410" y="38" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        A
      </text>
      <text x="410" y="50" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.35)" fontFamily="JetBrains Mono, monospace">
        INITIAL
      </text>
      <text x="410" y="60" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.35)" fontFamily="JetBrains Mono, monospace">
        2025-04
      </text>

      <rect x="8" y="8" width="72" height="28" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="0.5" />
      <text x="12" y="19" fontSize="6" fill="rgba(255,255,255,.25)" fontFamily="JetBrains Mono, monospace">
        МАСШТАБ
      </text>
      <text x="12" y="30" fontSize="7" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        1 : NTS
      </text>

      <line x1="220" y1="1" x2="220" y2="8" stroke="rgba(255,255,255,.22)" strokeWidth="0.6" />
      <line x1="220" y1="521" x2="220" y2="528" stroke="rgba(255,255,255,.22)" strokeWidth="0.6" />
      <line x1="1" y1="264" x2="8" y2="264" stroke="rgba(255,255,255,.22)" strokeWidth="0.6" />
      <line x1="432" y1="264" x2="439" y2="264" stroke="rgba(255,255,255,.22)" strokeWidth="0.6" />

      <text x="215" y="24" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.18)" fontFamily="JetBrains Mono, monospace">
        P&amp;ID — PROCESS LOOP PID-001
      </text>

      <rect x="28" y="178" width="60" height="106" rx="2" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1.5" />
      <g className="pid-lv" style={{ transformBox: "fill-box", transformOrigin: "bottom center" }}>
        <rect x="33" y="225" width="50" height="55" fill="rgba(217,119,6,.1)" />
      </g>
      <text x="58" y="300" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        T-01
      </text>
      <line x1="58" y1="178" x2="58" y2="155" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="58" cy="144" r="12" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" className="pid-ib2" />
      <text x="58" y="147" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        LI
      </text>

      <circle cx="168" cy="240" r="20" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1.5" />
      <g className="pid-spin" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <polygon points="168,224 181,254 155,254" fill="none" stroke="rgba(217,119,6,.65)" strokeWidth="1.4" />
      </g>
      <text x="168" y="274" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        P-01
      </text>

      <g className="pid-vp">
        <polygon
          points="248,228 248,252 265,240"
          fill="rgba(217,119,6,.12)"
          stroke="rgba(217,119,6,.75)"
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
        <polygon
          points="282,228 282,252 265,240"
          fill="rgba(217,119,6,.12)"
          stroke="rgba(217,119,6,.75)"
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
      </g>
      <line x1="265" y1="228" x2="265" y2="210" stroke="rgba(217,119,6,.5)" strokeWidth="1.3" />
      <rect x="257" y="202" width="16" height="8" rx="1" fill="none" stroke="rgba(217,119,6,.5)" strokeWidth="1" />
      <text x="265" y="272" textAnchor="middle" fontSize="8" fill="rgba(217,119,6,.4)" fontFamily="JetBrains Mono, monospace">
        FCV-01
      </text>

      <rect x="336" y="218" width="74" height="44" rx="2" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1.5" />
      <line x1="356" y1="218" x2="356" y2="262" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
      <line x1="373" y1="218" x2="373" y2="262" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
      <line x1="390" y1="218" x2="390" y2="262" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
      <line x1="364" y1="262" x2="364" y2="310" className="pid-fl pid-wh pid-fd2" />
      <line x1="382" y1="310" x2="382" y2="262" className="pid-fl pid-wh pid-fu2" />
      <text x="373" y="325" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        E-01
      </text>
      <line x1="373" y1="218" x2="373" y2="185" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="373" cy="173" r="12" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" className="pid-ib2" />
      <text x="373" y="176" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        TI
      </text>

      <line x1="88" y1="240" x2="148" y2="240" className="pid-fl pid-or pid-fr" />
      <line x1="188" y1="240" x2="248" y2="240" className="pid-fl pid-or pid-fr" />
      <line x1="282" y1="240" x2="336" y2="240" className="pid-fl pid-or pid-fr" />
      <line x1="410" y1="240" x2="422" y2="240" className="pid-fl pid-or pid-fr" markerEnd="url(#pa1)" />

      <line x1="418" y1="240" x2="418" y2="380" className="pid-fl pid-wh pid-fd" />
      <line x1="418" y1="380" x2="58" y2="380" className="pid-fl pid-wh pid-fl2" />
      <line x1="58" y1="380" x2="58" y2="284" className="pid-fl pid-wh pid-fu" markerEnd="url(#pa2)" />

      <line x1="220" y1="240" x2="220" y2="205" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="220" cy="193" r="12" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" className="pid-ib" />
      <text x="220" y="196" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        FI
      </text>

      <line x1="416" y1="240" x2="416" y2="205" stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="416" cy="193" r="12" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" className="pid-ib" />
      <text x="416" y="196" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)" fontFamily="JetBrains Mono, monospace">
        PI
      </text>
    </svg>
  );
};

export default function EQMLogin({ onLogin, version = DEFAULTS.version, sessionExpired = DEFAULTS.sessionExpired }) {
  const rootRef = useRef(null);
  const glowRef = useRef(null);
  const whSvgRef = useRef(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useForklift(whSvgRef);

  useEffect(() => {
    if (document.getElementById("eqm-styles")) {
      return undefined;
    }
    const style = document.createElement("style");
    style.id = "eqm-styles";
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

.eqm-root {
  min-height: 100vh;
  display: flex;
  flex-direction: row;
  position: relative;
  overflow: hidden;
  background: #203043;
  font-family: Inter, sans-serif;
  color: #f0f0f0;
}
.eqm-bg-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
  z-index: 1;
}
.eqm-top-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #d97706;
  z-index: 10;
}
.eqm-cursor-glow {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  transition: background 0.06s linear;
}

.eqm-wh-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 6px;
  border-right: 1px solid rgba(255,255,255,0.07);
  animation: eqmAppear 0.5s 0.1s both;
  position: relative;
  z-index: 2;
}
.eqm-wh-title {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: rgba(255,255,255,0.18);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.eqm-wh-svg {
  width: 100%;
  max-width: 690px;
  height: auto;
}
.eqm-wh-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 14px;
  width: 100%;
  max-width: 320px;
}
.eqm-wh-stat {
  display: flex;
  gap: 8px;
  align-items: center;
}
.eqm-wh-stat + .eqm-wh-stat {
  border-left: 1px solid rgba(255,255,255,0.08);
  padding-left: 10px;
}
.eqm-wh-val {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: #e5e5e5;
}
.eqm-wh-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.25);
}

.eqm-login-panel {
  width: 390px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 54px 40px;
  background: linear-gradient(180deg, var(--eqm-shell-accent) 0%, var(--eqm-shell) 100%);
  border-left: 1px solid rgba(255,255,255,0.07);
  border-right: 1px solid rgba(255,255,255,0.07);
  position: relative;
  z-index: 10;
  animation: eqmSlideUp 0.5s 0.15s cubic-bezier(.16,1,.3,1) both;
}
.eqm-brand-top {
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.eqm-brand-top .eqm-logo-box {
  width: 64px;
  height: 64px;
  font-size: 20px;
  font-weight: 700;
}
.eqm-login-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #d97706;
}
.eqm-logo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  margin-bottom: 24px;
  justify-content: center;
}
.eqm-logo-box {
  width: 32px;
  height: 32px;
  border: 1.5px solid #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #d97706;
}
.eqm-logo-label {
  font-size: 12px;
  color: rgba(255,255,255,.4);
}
.eqm-section-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255,255,255,.2);
  margin-bottom: 5px;
}
.eqm-title {
  font-size: 25px;
  font-weight: 600;
  color: #f0f0f0;
  letter-spacing: -0.3px;
  margin-bottom: 28px;
}
.eqm-alert {
  display: flex;
  gap: 9px;
  background: rgba(217,119,6,.07);
  border-left: 2px solid #d97706;
  padding: 12px 14px;
  margin-bottom: 22px;
  border-radius: 0 2px 2px 0;
  font-size: 13px;
  color: rgba(255,200,100,.75);
  line-height: 1.5;
}
.eqm-alert-icon {
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 1px;
}
.eqm-form {
  display: grid;
  gap: 18px;
}
.eqm-field {
  display: grid;
  gap: 8px;
}
.eqm-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,.38);
}
.eqm-label span {
  color: #d97706;
}
.eqm-input {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 3px;
  padding: 11px 13px;
  font-size: 15px;
  color: #e8e8e8;
  outline: none;
}
.eqm-input::placeholder {
  color: rgba(255,255,255,.15);
}
.eqm-input:focus {
  border-color: rgba(217,119,6,.5);
  background: rgba(217,119,6,.04);
}
.eqm-submit {
  width: 100%;
  padding: 13px;
  background: #d97706;
  border: none;
  border-radius: 3px;
  color: #000;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: .3px;
  cursor: pointer;
  margin-top: 10px;
}
.eqm-submit:hover {
  background: #e58c10;
}
.eqm-submit:active {
  background: #c26b05;
}
.eqm-submit:disabled {
  opacity: .4;
  cursor: default;
}
.eqm-footer {
  margin-top: 20px;
  border-top: 1px solid rgba(255,255,255,.06);
  padding-top: 16px;
  font-size: 13px;
  color: rgba(255,255,255,.18);
  line-height: 1.7;
}
.eqm-footer a,
.eqm-link {
  color: rgba(217,119,6,.55);
  text-decoration: none;
}
.eqm-footer a:hover,
.eqm-link:hover {
  color: #d97706;
}
.eqm-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.eqm-pid-panel {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 6px;
  border-left: 1px solid rgba(255,255,255,0.07);
  animation: eqmAppear 0.5s 0.2s both;
  position: relative;
  z-index: 2;
}
.eqm-pid-svg {
  width: 100%;
  max-width: 845px;
  height: auto;
}

.pid-fl { fill: none; stroke-dasharray: 6 4; }
.pid-or { stroke: rgba(217,119,6,.6); stroke-width: 1.4; }
.pid-wh { stroke: rgba(255,255,255,.2); stroke-width: 1.4; }
.pid-fr { animation: pidFR 3s linear infinite; }
.pid-fl2 { animation: pidFL 3s linear infinite; }
.pid-fd { animation: pidFD 3s linear infinite; }
.pid-fu { animation: pidFU 3s linear infinite; }
.pid-fd2 { animation: pidFD 4s 1s linear infinite; }
.pid-fu2 { animation: pidFU 4s linear infinite; }
.pid-ib { animation: pidIB 2.5s ease-in-out infinite; }
.pid-ib2 { animation: pidIB2 3.5s 1s ease-in-out infinite; }
.pid-spin { animation: pidSpin 4s linear infinite; transform-box: fill-box; transform-origin: center; }
.pid-vp { animation: pidVP 4s ease-in-out infinite; }
.pid-lv { animation: pidLV 5s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }

.eqm-cell-p { animation: eqmCellP 2.5s ease-in-out infinite; }
.eqm-scan-r { animation: eqmScanR 1.8s ease-in-out infinite; }

@keyframes eqmAppear {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes eqmSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes eqmCellP { 0%,100% { opacity: .2 } 50% { opacity: .7 } }
@keyframes eqmScanR { 0%,100% { r: 5; opacity: .7 } 50% { r: 9; opacity: 0 } }
@keyframes pidFR { to { stroke-dashoffset: -20; } }
@keyframes pidFL { to { stroke-dashoffset: 20; } }
@keyframes pidFD { to { stroke-dashoffset: -20; } }
@keyframes pidFU { to { stroke-dashoffset: 20; } }
@keyframes pidIB { 0%,100% { opacity: .35 } 50% { opacity: .95 } }
@keyframes pidIB2 { 0%,100% { opacity: .25 } 50% { opacity: .85 } }
@keyframes pidSpin { to { transform: rotate(360deg); } }
@keyframes pidVP { 0%,100% { opacity: .4 } 50% { opacity: .85 } }
@keyframes pidLV { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.6) } }
`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const handleMouseMove = (event) => {
    const node = rootRef.current;
    const glow = glowRef.current;
    if (!node || !glow) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    glow.style.background = `radial-gradient(circle 300px at ${x}px ${y}px, rgba(217,119,6,0.07) 0%, rgba(217,119,6,0.025) 40%, transparent 70%)`;
  };

  const handleMouseLeave = () => {
    if (glowRef.current) {
      glowRef.current.style.background = "none";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onLogin || loading) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onLogin({ login, password });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка авторизации";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = sessionExpired || Boolean(error);
  const alertText = sessionExpired
    ? "Сессия истекла. Войди снова — EQM вернёт тебя на нужную страницу."
    : error || "";

  return (
    <div
      ref={rootRef}
      className="eqm-root"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="eqm-bg-grid" />
      <div className="eqm-top-accent" />
      <div className="eqm-cursor-glow" ref={glowRef} />

      <div className="eqm-wh-panel">
        <div className="eqm-wh-title">ПЛАН — СКЛАД WH-01</div>
        <WarehouseSVG svgRef={whSvgRef} />
        <div className="eqm-wh-stats">
          <div className="eqm-wh-stat">
            <div className="eqm-wh-val">4 821</div>
            <div className="eqm-wh-label">Активов</div>
          </div>
          <div className="eqm-wh-stat">
            <div className="eqm-wh-val">11×9</div>
            <div className="eqm-wh-label">Ячеек</div>
          </div>
          <div className="eqm-wh-stat">
            <div className="eqm-wh-val">75.0м</div>
            <div className="eqm-wh-label">Длина</div>
          </div>
        </div>
      </div>

        <div className="eqm-login-panel">
          <div className="eqm-login-top" />
        <div className="eqm-brand-top">
          <div className="eqm-logo-box">EQM</div>
        </div>
        <div className="eqm-logo-row" />
        <div className="eqm-section-label">Авторизация</div>
        <div className="eqm-title">Вход в систему</div>

        {showAlert ? (
          <div className="eqm-alert">
            <div className="eqm-alert-icon">▲</div>
            <div>{alertText}</div>
          </div>
        ) : null}

        <form className="eqm-form" onSubmit={handleSubmit}>
          <label className="eqm-field">
            <span className="eqm-label">
              Логин <span>*</span>
            </span>
            <input
              className="eqm-input"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              required
            />
          </label>
          <label className="eqm-field">
            <span className="eqm-label">
              Пароль <span>*</span>
            </span>
            <input
              className="eqm-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="eqm-submit" type="submit" disabled={loading}>
            {loading ? "Выполняется вход…" : "Войти"}
          </button>
        </form>

        <div className="eqm-footer">
          Для создания аккаунта —{" "}
          <button type="button" className="eqm-link">
            обратитесь к администратору
          </button>{" "}
          via TrueConf
          <br />
          Версия {version}
        </div>
      </div>

      <div className="eqm-pid-panel">
        <PIDSVG />
      </div>
    </div>
  );
}
