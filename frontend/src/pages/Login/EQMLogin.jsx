import { useEffect, useRef, useState } from "react";

const DEFAULTS = {
  version: "v1.1.4",
  assetCount: "4 821",
  uptime: "99.8%",
  sessionExpired: false,
  developer: "EQM Engineering",
  object: "Насосный контур",
  date: "2025-04",
  sheet: "1 / 1",
  drawingNo: "PID-001"
};

export default function EQMLogin({
  onLogin,
  version = DEFAULTS.version,
  assetCount = DEFAULTS.assetCount,
  uptime = DEFAULTS.uptime,
  sessionExpired = DEFAULTS.sessionExpired,
  developer = DEFAULTS.developer,
  object = DEFAULTS.object,
  date = DEFAULTS.date,
  sheet = DEFAULTS.sheet,
  drawingNo = DEFAULTS.drawingNo
}) {
  const rootRef = useRef(null);
  const glowRef = useRef(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  position: relative;
  overflow: hidden;
  background: #111213;
  color: #f0f0f0;
  font-family: Inter, sans-serif;
}
.eqm-grid {
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
.eqm-glow {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}
.eqm-left {
  flex: 1;
  padding: 28px 36px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}
.eqm-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  animation: eqmAppear 0.9s ease both;
}
.eqm-logo {
  width: 34px;
  height: 34px;
  border: 1.5px solid #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #d97706;
  letter-spacing: 1px;
}
.eqm-brand-label {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}
.eqm-drawing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: eqmAppear 1.1s ease both;
  animation-delay: 0.08s;
}
.eqm-drawing svg {
  width: 100%;
  max-width: 500px;
  height: auto;
}
.eqm-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 12px;
  animation: eqmAppear 1.2s ease both;
  animation-delay: 0.16s;
}
.eqm-stat {
  display: flex;
  align-items: center;
  gap: 12px;
}
.eqm-stat + .eqm-stat {
  border-left: 1px solid rgba(255,255,255,0.08);
  padding-left: 12px;
}
.eqm-stat-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 15px;
  font-weight: 500;
  color: #e5e5e5;
}
.eqm-stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255,255,255,0.25);
}
.eqm-separator {
  display: none;
}
.eqm-right {
  position: absolute;
  right: 36px;
  top: 52px;
  width: 380px;
  background: rgba(13,14,15,0.78);
  padding: 56px 44px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 18px 40px rgba(0,0,0,0.45);
  backdrop-filter: blur(6px);
  z-index: 6;
  animation: eqmSlideIn 0.9s ease both;
}
.eqm-section-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.32);
}
.eqm-title {
  margin-top: 10px;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: #f0f0f0;
}
.eqm-alert {
  margin-top: 24px;
  display: flex;
  gap: 10px;
  background: rgba(217,119,6,0.07);
  border-left: 2px solid #d97706;
  padding: 12px 16px;
  border-radius: 0 2px 2px 0;
  font-size: 13px;
  color: rgba(255,200,100,0.75);
  line-height: 1.5;
}
.eqm-alert-icon {
  font-size: 11px;
  flex-shrink: 0;
}
.eqm-form {
  margin-top: 24px;
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
  color: rgba(255,255,255,0.45);
}
.eqm-label span {
  color: #d97706;
}
.eqm-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 3px;
  padding: 12px 14px;
  font-size: 15px;
  color: #e8e8e8;
  outline: none;
}
.eqm-input:focus {
  border-color: rgba(217,119,6,0.5);
  background: rgba(217,119,6,0.04);
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
  letter-spacing: 0.3px;
  cursor: pointer;
}
.eqm-submit:hover {
  background: #e58c10;
}
.eqm-submit:disabled {
  opacity: 0.4;
  cursor: default;
}
.eqm-footer {
  margin-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 18px;
  font-size: 12px;
  color: rgba(255,255,255,0.18);
  line-height: 1.7;
}
.eqm-footer a,
.eqm-link {
  color: rgba(217,119,6,0.55);
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

.pid-text {
  font-family: "JetBrains Mono", monospace;
}
.pid-line-orange {
  stroke: rgba(217,119,6,0.55);
  stroke-width: 1.5;
  fill: none;
  stroke-dasharray: 6 4;
  animation: pidFlowR 3s linear infinite;
}
.pid-line-white {
  stroke: rgba(255,255,255,0.18);
  stroke-width: 1.5;
  fill: none;
  stroke-dasharray: 6 4;
}
.pid-flow-up {
  animation: pidFlowU 3s linear infinite;
}
.pid-flow-left {
  animation: pidFlowL 3s linear infinite;
}
.pid-flow-down {
  animation: pidFlowD 3s linear infinite;
}
.pid-blink {
  animation: pidBlink 2.5s ease-in-out infinite;
}
.pid-blink2 {
  animation: pidBlink2 3.5s ease-in-out infinite;
  animation-delay: 1s;
}
.pid-spin {
  animation: pidSpin 4s linear infinite;
}
.pid-vp {
  animation: pidVP 4s ease-in-out infinite;
}
.pid-lv {
  animation: pidLV 5s ease-in-out infinite;
}

@keyframes eqmAppear {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes eqmSlideIn {
  0% { opacity: 0; transform: translateX(20px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes eqmDivFlow {
  0% { top: -120px; opacity: 0; }
  40% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
@keyframes pidFlowR {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: -20; }
}
@keyframes pidFlowL {
  0% { stroke-dashoffset: -20; }
  100% { stroke-dashoffset: 20; }
}
@keyframes pidFlowD {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: -20; }
}
@keyframes pidFlowU {
  0% { stroke-dashoffset: -20; }
  100% { stroke-dashoffset: 20; }
}
@keyframes pidBlink {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}
@keyframes pidBlink2 {
  0% { opacity: 0.35; }
  50% { opacity: 0.9; }
  100% { opacity: 0.35; }
}
@keyframes pidSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes pidVP {
  0% { opacity: 0.45; }
  50% { opacity: 0.85; }
  100% { opacity: 0.45; }
}
@keyframes pidLV {
  0% { transform: scaleY(1); }
  50% { transform: scaleY(0.65); }
  100% { transform: scaleY(1); }
}
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
    glow.style.background = `radial-gradient(circle 280px at ${x}px ${y}px, rgba(217,119,6,0.08) 0%, rgba(217,119,6,0.03) 40%, transparent 70%)`;
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
    ? "Сессия истекла. Войди снова, и EQM вернёт тебя на нужную страницу."
    : error || "";

  return (
    <div
      ref={rootRef}
      className="eqm-root"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="eqm-grid" />
      <div className="eqm-top-accent" />
      <div className="eqm-glow" ref={glowRef} />

      <div className="eqm-left">
        <div className="eqm-brand">
          <div className="eqm-logo">EQM</div>
          <div className="eqm-brand-label">Equipment Management Platform</div>
        </div>

        <div className="eqm-drawing">
          <svg viewBox="0 0 500 340" aria-hidden="true">
            <defs>
              <marker
                id="eqmA1"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path
                  d="M1 1L7 4L1 7"
                  fill="none"
                  stroke="rgba(217,119,6,0.55)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </marker>
              <marker
                id="eqmA2"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path
                  d="M1 1L7 4L1 7"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </marker>
            </defs>

            <rect x="2" y="2" width="496" height="336" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            <rect x="10" y="10" width="480" height="280" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <rect x="10" y="290" width="480" height="46" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <line x1="160" y1="290" x2="160" y2="336" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <line x1="310" y1="290" x2="310" y2="336" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <line x1="400" y1="290" x2="400" y2="336" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <line x1="10" y1="313" x2="490" y2="313" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <text x="16" y="304" className="pid-text" fontSize="6" fill="rgba(255,255,255,0.25)" letterSpacing="1">
              РАЗРАБОТАЛ
            </text>
            <text x="166" y="304" className="pid-text" fontSize="6" fill="rgba(255,255,255,0.25)" letterSpacing="1">
              ОБЪЕКТ
            </text>
            <text x="316" y="304" className="pid-text" fontSize="6" fill="rgba(255,255,255,0.25)" letterSpacing="1">
              ДАТА
            </text>
            <text x="406" y="304" className="pid-text" fontSize="6" fill="rgba(255,255,255,0.25)" letterSpacing="1">
              ЛИСТ
            </text>
            <text x="16" y="327" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)">
              {developer}
            </text>
            <text x="166" y="327" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)">
              {object}
            </text>
            <text x="316" y="327" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)">
              {date}
            </text>
            <text x="406" y="327" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)">
              {sheet}
            </text>
            <text x="486" y="332" className="pid-text" fontSize="7" fill="rgba(217,119,6,0.5)" textAnchor="end">
              {drawingNo}
            </text>

            <rect x="440" y="10" width="50" height="60" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <text x="465" y="22" className="pid-text" fontSize="6" fill="rgba(255,255,255,0.25)" textAnchor="middle">
              REV
            </text>
            <line x1="440" y1="25" x2="490" y2="25" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <text x="465" y="38" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              A
            </text>
            <text x="465" y="51" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              INITIAL
            </text>
            <text x="465" y="63" className="pid-text" fontSize="7" fill="rgba(255,255,255,0.35)" textAnchor="middle">
              {date}
            </text>

            <rect x="10" y="10" width="70" height="30" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <text x="16" y="21" className="pid-text" fontSize="6" fill="rgba(255,255,255,0.25)">
              МАСШТАБ
            </text>
            <text x="16" y="33" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)">
              1 : NTS
            </text>

            <line x1="250" y1="2" x2="250" y2="10" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <line x1="250" y1="330" x2="250" y2="338" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <line x1="2" y1="170" x2="10" y2="170" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <line x1="490" y1="170" x2="498" y2="170" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />

            <rect x="32" y="88" width="50" height="86" rx="2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <g className="pid-lv" style={{ transformBox: "fill-box", transformOrigin: "bottom center" }}>
              <rect x="37" y="130" width="40" height="40" fill="rgba(217,119,6,0.1)" />
            </g>
            <text x="57" y="190" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              T-01
            </text>
            <line x1="57" y1="88" x2="57" y2="68" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="57" cy="57" r="10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" className="pid-blink2" />
            <text x="57" y="60" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              LI
            </text>

            <circle cx="155" cy="145" r="17" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <g className="pid-spin" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <polygon points="155,133 165,156 145,156" fill="none" stroke="rgba(217,119,6,0.6)" strokeWidth="1.2" />
            </g>
            <text x="155" y="175" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              P-01
            </text>

            <g className="pid-vp">
              <polygon
                points="221,134 221,156 239,145"
                fill="rgba(217,119,6,0.1)"
                stroke="rgba(217,119,6,0.7)"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
              <polygon
                points="257,134 257,156 239,145"
                fill="rgba(217,119,6,0.1)"
                stroke="rgba(217,119,6,0.7)"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
            </g>
            <line x1="239" y1="134" x2="239" y2="118" stroke="rgba(217,119,6,0.5)" strokeWidth="1" />
            <rect x="232" y="111" width="14" height="7" rx="1" fill="none" stroke="rgba(217,119,6,0.5)" strokeWidth="1" />
            <text x="239" y="195" className="pid-text" fontSize="8" fill="rgba(217,119,6,0.4)" textAnchor="middle">
              FCV-01
            </text>

            <rect x="308" y="126" width="68" height="38" rx="2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <line x1="325" y1="126" x2="325" y2="164" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <line x1="342" y1="126" x2="342" y2="164" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <line x1="359" y1="126" x2="359" y2="164" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <line x1="334" y1="126" x2="334" y2="164" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="351" y1="126" x2="351" y2="164" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 3" />
            <text x="342" y="218" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              E-01
            </text>
            <line x1="342" y1="126" x2="342" y2="96" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="342" cy="85" r="10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <text x="342" y="88" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              TI
            </text>

            <line x1="82" y1="145" x2="138" y2="145" className="pid-line-orange" />
            <line x1="172" y1="145" x2="221" y2="145" className="pid-line-orange" />
            <line x1="257" y1="145" x2="308" y2="145" className="pid-line-orange" />
            <line x1="376" y1="145" x2="428" y2="145" className="pid-line-orange" markerEnd="url(#eqmA1)" />

            <line x1="415" y1="145" x2="415" y2="240" className="pid-line-white pid-flow-down" />
            <line x1="415" y1="240" x2="57" y2="240" className="pid-line-white pid-flow-left" />
            <line x1="57" y1="240" x2="57" y2="174" className="pid-line-white pid-flow-up" markerEnd="url(#eqmA2)" />

            <line x1="200" y1="145" x2="200" y2="112" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="200" cy="101" r="10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" className="pid-blink" />
            <text x="200" y="104" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              FI
            </text>

            <line x1="410" y1="145" x2="410" y2="112" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="410" cy="101" r="10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" className="pid-blink" />
            <text x="410" y="104" className="pid-text" fontSize="8" fill="rgba(255,255,255,0.45)" textAnchor="middle">
              PI
            </text>
          </svg>
        </div>

        <div className="eqm-stats">
          <div className="eqm-stat">
            <div className="eqm-stat-value">{uptime}</div>
            <div className="eqm-stat-label">Uptime</div>
          </div>
          <div className="eqm-stat">
            <div className="eqm-stat-value">{assetCount}</div>
            <div className="eqm-stat-label">Активов</div>
          </div>
          <div className="eqm-stat">
            <div className="eqm-stat-value">{version}</div>
            <div className="eqm-stat-label">Версия</div>
          </div>
        </div>
      </div>

      <div className="eqm-separator" />

      <div className="eqm-right">
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
          Для создания аккаунта — <button type="button" className="eqm-link">обратитесь к администратору</button>{" "}
          via TrueConf
          <br />
          Версия {version}
        </div>
      </div>
    </div>
  );
}
