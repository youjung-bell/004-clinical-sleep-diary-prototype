import { useState, useRef, useEffect } from "react";
import svgPaths from "../imports/수면기록기입/svg-86llk59269";

// Timeline 좌표/매핑 공통 helper
const START_HOUR = 18; // 6PM부터 시작
const COLLAPSED_RANGE = 20; // 6PM ~ 2PM (다음날 14:00)
const EXPANDED_RANGE = 24; // 6PM ~ 6PM (다음날 18:00, 전체)

// 시간 → 슬라이더 내 위치(0~100%)
function hourToPercent(hour: number, expanded: boolean): number {
  const range = expanded ? EXPANDED_RANGE : COLLAPSED_RANGE;
  const offset = (hour - START_HOUR + 24) % 24;
  return Math.min(100, Math.max(0, (offset / range) * 100));
}

// 슬라이더 내 위치(0~1) → 시간
function ratioToHour(ratio: number, expanded: boolean): number {
  const range = expanded ? EXPANDED_RANGE : COLLAPSED_RANGE;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (clamped * range + START_HOUR) % 24;
}

const COLLAPSED_MARKERS = ["오후 6시", "오후 10시", "오전 2시", "오전 6시", "오전 10시", "오후 2시"];
const EXPANDED_MARKERS = ["오후 6시", "오후 10시", "오전 2시", "오전 6시", "오전 10시", "오후 2시", "오후 6시"];

// 핸들이 끝에 도달하면 자동 확장, 충분히 위로 가면 자동 축소 (hysteresis)
const EXPAND_THRESHOLD = 95;
const COLLAPSE_THRESHOLD = 78;

// 깬 시간 총합 WheelPicker 값 리스트 (분 단위, 360 = 6시간 이상)
const WAKE_MINUTE_VALUES = [
  0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 60, 90, 120, 150, 180, 240, 300, 360,
];

// Sleep latency 분 단위 → 사람 친화 라벨
function formatLatency(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return "바로 잠들었어요";
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}

function formatWakeMinutes(m: number): string {
  if (m === 360) return "6시간 이상";
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const remainder = m % 60;
  if (remainder === 0) return `${h}시간`;
  return `${h}시간 ${remainder}분`;
}

// 18시(6PM) 기준으로 newHour를 [minHour, maxHour] 범위로 clamp
function clampHourInRange(newHour: number, minHour: number, maxHour: number): number {
  const refNew = (newHour - 18 + 24) % 24;
  const refMin = (minHour - 18 + 24) % 24;
  const refMax = (maxHour - 18 + 24) % 24;
  const clamped = Math.max(refMin, Math.min(refMax, refNew));
  return (clamped + 18) % 24;
}

// time input ↔ hour 변환 (24시간 "HH:MM" 형식)
function hourToTimeInput(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeInputToHour(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

// 시간 picker가 있는 칩 — 시각 부분 클릭 시 native time picker 표시
function EditableTimeChip({
  label,
  icon,
  hour,
  onChange,
  minWidth = 130,
}: {
  label: string;
  icon: string;
  hour: number;
  onChange: (h: number) => void;
  minWidth?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formatTimeShort = (hh: number) => {
    const h = Math.floor(hh);
    const m = Math.round((hh - h) * 60);
    const period = h < 12 ? "오전" : "오후";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0
      ? `${period} ${display}시`
      : `${period} ${display}시 ${String(m).padStart(2, "0")}분`;
  };
  return (
    <div
      className="bg-[#2D3748] px-4 py-2.5 rounded-lg text-white whitespace-nowrap select-none flex flex-col items-start gap-1.5 shadow-lg pointer-events-auto"
      style={{ minWidth }}
    >
      <p className="text-[10px] text-white/60 leading-none">{label}</p>
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          // showPicker는 일부 브라우저에서만 지원 → fallback focus
          // @ts-expect-error - showPicker 타입 보장 X
          if (typeof el.showPicker === "function") el.showPicker();
          else el.focus();
        }}
        className="text-[15px] font-bold leading-none flex items-center gap-1.5 cursor-pointer hover:text-white/90 active:text-white/80"
      >
        <span>{icon}</span>
        <span>{formatTimeShort(hour)}</span>
      </button>
      <input
        ref={inputRef}
        type="time"
        value={hourToTimeInput(hour)}
        onChange={(e) => {
          if (!e.target.value) return;
          onChange(timeInputToHour(e.target.value));
        }}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
}

function PrototypeMenu({ onSelect }: { onSelect: (screen: string) => void }) {
  return (
    <div
      className="relative size-full flex flex-col items-center justify-center px-6 gap-8"
      style={{ backgroundImage: "linear-gradient(rgb(1, 1, 1) 0%, rgb(18, 18, 26) 55%, rgb(35, 37, 50) 90%, rgb(45, 47, 62) 100%)" }}
    >
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-white text-[22px] font-bold">SleepThera v2.0.1</h1>
        <p className="text-[13px] text-white/40">연장연구 대비 인터랙티브 프로토타입</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-[327px]">
        <button
          onClick={() => onSelect("sleep-diary")}
          className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-5 text-left flex flex-col gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-all active:scale-[0.98]"
        >
          <span className="text-[10px] font-semibold text-white/40 tracking-wider">SREC-001</span>
          <span className="text-white text-[17px] font-bold">수면 기록 Create</span>
          <span className="text-[12px] text-white/50 leading-relaxed">수면의 질, 침대 시간, 입면지연시간, 실제 수면 시간, 중간 각성 기록</span>
        </button>
        <button
          onClick={() => onSelect("access-code")}
          className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-5 text-left flex flex-col gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-all active:scale-[0.98]"
        >
          <span className="text-[10px] font-semibold text-white/40 tracking-wider">AUTH-002</span>
          <span className="text-white text-[17px] font-bold">가입코드 입력</span>
          <span className="text-[12px] text-white/50 leading-relaxed">액세스 코드를 입력하여 서비스에 가입</span>
        </button>
      </div>
      <p className="text-[11px] text-white/20 mt-4">BELL Therapeutics · 2026</p>
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [sleepQuality, setSleepQuality] = useState(0);
  const [bedTimeHour, setBedTimeHour] = useState(22); // 침대에 누운 시각
  const [outOfBedHour, setOutOfBedHour] = useState(7); // 침대에서 일어나 나온 시각
  const [sleepTimeHour, setSleepTimeHour] = useState(23); // 실제로 잠든 시각
  const [wakeTimeHour, setWakeTimeHour] = useState(6); // 실제로 깬 시각
  const [sleepAttemptHour, setSleepAttemptHour] =
    useState(22.5); // 잠을 자려고 시도한 시각
  const [wakeCount, setWakeCount] = useState(0); // 밤중에 깬 횟수
  const [wakeTotalMinutes, setWakeTotalMinutes] = useState(0); // 깬 시간의 총 합 (분)
  const [wakeSubStep, setWakeSubStep] = useState(0); // 0: 초기, 1: 횟수 입력, 2: 시간 입력
  const [showModal, setShowModal] = useState(false); // 최종 모달
  const [sleepNote, setSleepNote] = useState(""); // 수면에 영향을 준 사건
  const [step2Initialized, setStep2Initialized] =
    useState(false); // 2단계 초기화 완료 여부
  const [step3Initialized, setStep3Initialized] =
    useState(false); // 3단계 초기화 완료 여부

  const totalSteps = 5;

  // 1단계에서 2단계로 넘어갈 때 값 복사 (한 번만)
  useEffect(() => {
    if (currentStep === 2 && !step2Initialized) {
      // 침대에 누운 시간으로 설정
      setSleepAttemptHour(bedTimeHour);
      setStep2Initialized(true);
    }
    if (currentStep === 3 && !step3Initialized) {
      setSleepTimeHour(sleepAttemptHour);
      setWakeTimeHour(outOfBedHour);
      setStep3Initialized(true);
    }
    // 스텝이 바뀌면 초기화 플래그 리셋
    if (currentStep < 2) {
      setStep2Initialized(false);
    }
    if (currentStep < 3) {
      setStep3Initialized(false);
    }
  }, [
    currentStep,
    bedTimeHour,
    outOfBedHour,
    sleepAttemptHour,
    step2Initialized,
    step3Initialized,
  ]);

  const formatHourToTime = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h < 12 ? "오전" : "오후";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${period} ${displayHour}시 ${String(m).padStart(2, "0")}분`;
  };

  const calculateSleepDuration = () => {
    let duration = wakeTimeHour - sleepTimeHour;
    if (duration < 0) duration += 24;
    return duration;
  };

  const calculateTimeToSleep = () => {
    let duration = sleepTimeHour - bedTimeHour;
    if (duration < 0) duration += 24;
    return duration * 60; // 분 단위로 반환
  };

  const handleNext = () => {
    if (currentStep === 4) {
      // 4단계에서 서브스텝 관리
      if (wakeSubStep === 1) {
        if (wakeCount > 0) {
          setWakeSubStep(2);
        }
        return;
      }
      // wakeSubStep === -1 또는 2일 때 모달 띄우기
      setShowModal(true);
    } else if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 4 && wakeSubStep === 2) {
      // 4단계 서브스텝 2에서 뒤로가기 -> 서브스텝 1로
      setWakeSubStep(1);
    } else if (currentStep === 4 && wakeSubStep === 1) {
      // 4단계 서브스텝 1에서 뒤로가기 -> 서브스텝 0으로
      setWakeSubStep(0);
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleWakeYes = () => {
    setWakeSubStep(1);
    if (wakeCount === 0) setWakeCount(1);
  };

  const handleWakeNo = () => {
    setWakeCount(0);
    setWakeTotalMinutes(0);
    setWakeSubStep(-1);
    setShowModal(true);
  };

  const handleFinalSubmit = () => {
    alert("수면 기록이 저장되었습니다!");
    console.log({
      sleepQuality,
      bedTime: formatHourToTime(bedTimeHour),
      outOfBedTime: formatHourToTime(outOfBedHour),
      sleepAttemptTime: formatHourToTime(sleepAttemptHour),
      sleepTime: formatHourToTime(sleepTimeHour),
      wakeTime: formatHourToTime(wakeTimeHour),
      timeToSleepMinutes: calculateTimeToSleep(),
      wakeCount,
      wakeTotalMinutes,
      sleepDuration: calculateSleepDuration(),
      sleepNote,
    });

    // 모든 상태 초기화
    setShowModal(false);
    setCurrentStep(0);
    setSleepQuality(0);
    setBedTimeHour(22);
    setOutOfBedHour(7);
    setSleepAttemptHour(22.5);
    setSleepTimeHour(23);
    setWakeTimeHour(6);
    setWakeCount(0);
    setWakeTotalMinutes(0);
    setWakeSubStep(0);
    setSleepNote("");
    setStep2Initialized(false);
    setStep3Initialized(false);
  };

  const canProceed = () => {
    if (currentStep === 0) return sleepQuality > 0;
    if (currentStep === 1) return true;
    if (currentStep === 2) return true;
    if (currentStep === 3) return true;
    if (currentStep === 4) {
      // subStep 1: 횟수 입력 완료 여부, -1: 깬 적 없음, 2: 시간 입력 완료
      if (wakeSubStep === 1) return wakeCount > 0;
      return wakeSubStep === -1 || wakeSubStep === 2;
    }
    return false;
  };

  const getBackgroundGradient = () => {
    if (currentStep === 0) {
      // Step 0: Sleep Quality - gradient from dark to color
      const colors = [
        "#5C1A1A", // 1: red
        "#6B2020", // 2: red
        "#7A2A1A", // 3: red-orange
        "#8A4020", // 4: orange
        "#8A6A20", // 5: yellow-orange
        "#505050", // 6: neutral gray
        "#4A6A30", // 7: lime-green
        "#2A7A40", // 8: green
        "#1A6A6A", // 9: teal
        "#1A4A7A", // 10: blue
      ];
      // sleepQuality 0(미선택) → 중립 다크 배경
      const color = sleepQuality > 0 ? colors[sleepQuality - 1] : "#1a1a22";
      return `linear-gradient(180deg, #000000 0%, ${color} 100%)`;
    }
    // Other steps: default dark gradient
    return "linear-gradient(rgb(1, 1, 1) 0%, rgb(18, 18, 26) 55%, rgb(35, 37, 50) 90%, rgb(45, 47, 62) 100%)";
  };

  if (!currentScreen) {
    return <PrototypeMenu onSelect={setCurrentScreen} />;
  }

  if (currentScreen === "access-code") {
    return (
      <div className="relative size-full flex flex-col" style={{ background: "#f5f5f5" }}>
        <button
          onClick={() => setCurrentScreen(null)}
          className="absolute top-3 left-3 z-50 bg-black/60 text-white text-[12px] px-3 py-1.5 rounded-full backdrop-blur"
        >
          ← 목차
        </button>
        <iframe
          src="/auth-002.html"
          className="w-full flex-1 border-none"
          title="가입코드 입력"
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full max-w-[375px] h-screen mx-auto transition-all duration-500 overflow-hidden"
      style={{ backgroundImage: getBackgroundGradient() }}
    >
      {/* Status Bar */}
      <div className="absolute h-[50px] left-0 top-0 w-full">
        <div className="-translate-y-1/2 absolute contents left-[20px] top-[calc(50%+1px)]">
          <p className="-translate-x-1/2 absolute font-semibold leading-[normal] left-[47px] not-italic text-[15px] text-center text-white top-[calc(50%-9.09px)] tracking-[-0.165px] w-[54px]">
            9:41
          </p>
        </div>
        <div className="-translate-y-1/2 absolute h-[14px] right-[14px] top-[calc(50%+1px)] w-[68px]">
          <div className="absolute inset-[8.29%_0.74%_9.57%_0.74%]">
            <svg
              className="absolute block inset-0 size-full"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 67 11.5"
            >
              <g>
                <g>
                  <path
                    d={svgPaths.p1fa84700}
                    fill="white"
                    fillOpacity="0.3"
                  />
                  <rect
                    fill="white"
                    height="7.66667"
                    rx="1.6"
                    width="18"
                    x="44.5"
                    y="1.91667"
                  />
                </g>
                <path d={svgPaths.p2a20980} fill="white" />
                <path
                  clipRule="evenodd"
                  d={svgPaths.p28277f00}
                  fill="white"
                  fillRule="evenodd"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="-translate-x-1/2 absolute h-[64px] left-1/2 overflow-visible top-[50px] w-full">
        {/* Back Button */}
        {currentStep > 0 && (
          <div
            className="-translate-y-1/2 absolute left-[24px] size-[24px] top-[22px] cursor-pointer"
            onClick={handleBack}
          >
            <svg
              className="absolute block inset-0 size-full"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
              />
            </svg>
          </div>
        )}

        {/* Close Button */}
        <div className="-translate-y-1/2 absolute right-[24px] size-[24px] top-[22px] cursor-pointer">
          <svg
            className="absolute block inset-0 size-full"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 24 24"
          >
            <g opacity="0.7">
              <path
                clipRule="evenodd"
                d={svgPaths.p3f291270}
                fill="#EAEDEE"
                fillRule="evenodd"
              />
            </g>
          </svg>
        </div>

        <div className="-translate-x-1/2 absolute left-[calc(50%+0.5px)] top-[8px] flex flex-col items-center gap-0.5">
          <p className="font-bold leading-[1.5] not-italic text-[16px] text-center text-white tracking-[-0.016px] whitespace-nowrap">
            수면 기록
          </p>
          <p className="font-normal leading-[1.3] not-italic text-[10px] text-center text-[rgba(255,255,255,0.4)] tracking-[-0.01px] max-w-[280px]">
            11월 11일 오후 12:00 ~ 11월 12일 오전 11:59 사이의
            수면을 기록해주세요
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="absolute content-stretch flex flex-col items-center justify-center h-[600px] left-0 right-0 top-[138px] px-[24px] overflow-visible">
        {/* Step 0: Sleep Quality */}
        {currentStep === 0 && (
          <SleepQualityStep
            sleepQuality={sleepQuality}
            setSleepQuality={setSleepQuality}
          />
        )}

        {/* Step 1: Bed Time & Out of Bed Time */}
        {currentStep === 1 && (
          <BedTimeStep
            bedTimeHour={bedTimeHour}
            setBedTimeHour={setBedTimeHour}
            outOfBedHour={outOfBedHour}
            setOutOfBedHour={setOutOfBedHour}
            formatHourToTime={formatHourToTime}
          />
        )}

        {/* Step 2: Sleep Attempt Time */}
        {currentStep === 2 && (
          <SleepAttemptStep
            sleepAttemptHour={sleepAttemptHour}
            setSleepAttemptHour={setSleepAttemptHour}
            bedTimeHour={bedTimeHour}
            outOfBedHour={outOfBedHour}
            formatHourToTime={formatHourToTime}
          />
        )}

        {/* Step 3: Sleep Time & Wake Time */}
        {currentStep === 3 && (
          <SleepWakeTimeStep
            sleepTimeHour={sleepTimeHour}
            setSleepTimeHour={setSleepTimeHour}
            wakeTimeHour={wakeTimeHour}
            setWakeTimeHour={setWakeTimeHour}
            bedTimeHour={bedTimeHour}
            outOfBedHour={outOfBedHour}
            sleepAttemptHour={sleepAttemptHour}
            formatHourToTime={formatHourToTime}
            calculateSleepDuration={calculateSleepDuration}
          />
        )}

        {/* Step 4: Wake Events (Optional) */}
        {currentStep === 4 && (
          <WakeEventsStep
            wakeCount={wakeCount}
            setWakeCount={setWakeCount}
            wakeTotalMinutes={wakeTotalMinutes}
            setWakeTotalMinutes={setWakeTotalMinutes}
            wakeSubStep={wakeSubStep}
            setWakeSubStep={setWakeSubStep}
            onYes={handleWakeYes}
            onNo={handleWakeNo}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="-translate-x-1/2 absolute bottom-0 content-stretch flex flex-col items-start left-1/2 pb-[44px] px-[24px] w-full">
        <div className="flex gap-3 w-full">
          {/* Back Button */}
          {(currentStep > 0 ||
            (currentStep === 4 &&
              (wakeSubStep === 1 || wakeSubStep === 2))) && (
            <div
              className="h-[60px] relative rounded-[100px] shrink-0 w-[100px] cursor-pointer bg-[rgba(255,255,255,0.1)]"
              onClick={handleBack}
            >
              <div className="flex flex-row items-center justify-center size-full">
                <div className="flex flex-col font-semibold justify-center leading-[0] not-italic text-[16px] text-center text-white tracking-[-0.16px]">
                  <p className="leading-[1.5]">이전</p>
                </div>
              </div>
            </div>
          )}

          {/* Next/Submit Button */}
          <div
            className={`h-[60px] relative rounded-[100px] shrink-0 flex-1 cursor-pointer transition-all ${
              canProceed()
                ? "bg-[rgba(255,255,255,0.9)]"
                : "bg-[rgba(255,255,255,0.1)]"
            }`}
            onClick={handleNext}
          >
            <div className="flex flex-row items-center justify-center size-full">
              <div
                className={`flex flex-col font-semibold justify-center leading-[0] not-italic text-[16px] text-center tracking-[-0.16px] whitespace-nowrap ${
                  canProceed()
                    ? "text-[#121216]"
                    : "text-[rgba(255,255,255,0.2)]"
                }`}
              >
                <p className="leading-[1.5]">
                  {currentStep === totalSteps - 1 &&
                  (wakeSubStep === -1 || wakeSubStep === 2)
                    ? "수면 기록 완료"
                    : "다음"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-6">
          <div className="bg-[#1a1a22] rounded-2xl p-6 w-full max-w-[327px] flex flex-col gap-4">
            <h3 className="text-white text-[18px] font-bold text-center">
              수면에 영향을 준 사건이 있었나요?
            </h3>
            <textarea
              value={sleepNote}
              onChange={(e) => setSleepNote(e.target.value)}
              placeholder="예) 카페인, 운동, 스트레스, 늦은 식사..."
              className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.2)] rounded-lg px-4 py-3 text-white text-[14px] w-full h-[120px] resize-none placeholder:text-[rgba(255,255,255,0.4)]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] py-3 rounded-lg text-white text-[14px] font-semibold transition-all"
              >
                취소
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 bg-[rgba(255,255,255,0.9)] hover:bg-white py-3 rounded-lg text-[#121216] text-[14px] font-semibold transition-all"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SleepQualityStep({
  sleepQuality,
  setSleepQuality,
}: {
  sleepQuality: number;
  setSleepQuality: (q: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const handleSliderInteraction = (
    e:
      | React.MouseEvent<HTMLDivElement>
      | MouseEvent
      | React.TouchEvent<HTMLDivElement>
      | TouchEvent,
  ) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x =
      "touches" in e
        ? e.touches[0].clientX - rect.left
        : e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newQuality = Math.round(percentage * 9) + 1;
    setSleepQuality(Math.max(1, Math.min(10, newQuality)));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(
        0,
        Math.min(1, x / rect.width),
      );
      const newQuality = Math.round(percentage * 9) + 1;
      setSleepQuality(Math.max(1, Math.min(10, newQuality)));
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const percentage = Math.max(
        0,
        Math.min(1, x / rect.width),
      );
      const newQuality = Math.round(percentage * 9) + 1;
      setSleepQuality(Math.max(1, Math.min(10, newQuality)));
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener(
        "mousemove",
        handleMouseMove,
      );
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener(
        "touchmove",
        handleTouchMove,
      );
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, setSleepQuality]);

  return (
    <div className="flex flex-col items-center w-full gap-8 my-auto">
      <div className="text-center">
        <h2 className="text-white text-[24px] font-bold mb-2">
          수면의 질은 어땠나요?
        </h2>
      </div>

      <div className="relative shrink-0 w-full" ref={sliderRef}>
        <div
          className="relative h-[100px] cursor-pointer"
          onClick={handleSliderInteraction}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={(e) => {
            handleSliderInteraction(e);
            setIsDragging(true);
          }}
        >
          <div className="absolute flex flex-col font-normal bottom-0 left-0 justify-center leading-[0] not-italic text-[13px] text-[rgba(255,255,255,0.6)] tracking-[-0.013px] whitespace-nowrap">
            <p className="leading-[1.3]">매우 나쁨</p>
          </div>
          <div className="absolute flex flex-col font-normal bottom-0 right-0 justify-center leading-[0] not-italic text-[13px] text-[rgba(255,255,255,0.6)] text-right tracking-[-0.013px] whitespace-nowrap">
            <p className="leading-[1.3]">매우 좋음</p>
          </div>

          {/* Track */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2">
            <svg
              className="block w-full h-[10px]"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 327 10"
            >
              <path
                d={svgPaths.p3cf41880}
                fill="white"
                fillOpacity="0.3"
              />
            </svg>
          </div>

          {/* Dots */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-0 items-center">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <div
                key={num}
                className="relative size-[6px] cursor-pointer"
                onClick={() => setSleepQuality(num)}
              >
                <svg
                  className="absolute block inset-0 size-full"
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 6 6"
                >
                  <circle
                    cx="3"
                    cy="3"
                    fill="white"
                    fillOpacity={
                      sleepQuality >= num ? "1" : "0.4"
                    }
                    r="3"
                  />
                </svg>
              </div>
            ))}
          </div>

          {/* Quality Indicator - 완전 원, sleepQuality 0이면 숨김 */}
          {sleepQuality > 0 && (
            <div
              className="absolute w-[28px] h-[28px] bg-white rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-200 shadow-lg"
              style={{
                left: `${((sleepQuality - 1) / 9) * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="h-[72px] flex items-center justify-center">
        {sleepQuality > 0 ? (
          <div className="text-white text-[48px] font-bold">
            {sleepQuality}
          </div>
        ) : (
          <div className="text-white/40 text-[15px]">
            탭하거나 드래그하여 선택해주세요
          </div>
        )}
      </div>
    </div>
  );
}

function BedTimeStep({
  bedTimeHour,
  setBedTimeHour,
  outOfBedHour,
  setOutOfBedHour,
  formatHourToTime,
}: {
  bedTimeHour: number;
  setBedTimeHour: (h: number) => void;
  outOfBedHour: number;
  setOutOfBedHour: (h: number) => void;
  formatHourToTime: (h: number) => string;
}) {
  const [draggingPoint, setDraggingPoint] = useState<
    string | null
  >(null);
  const [expanded, setExpanded] = useState(false);
  const [fineMode, setFineMode] = useState<string | null>(null);
  const [fineOrigin, setFineOrigin] = useState(0); // %
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const expandedRef = useRef(expanded);
  const longPressTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const fineModeRef = useRef<string | null>(null);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);
  useEffect(() => {
    fineModeRef.current = fineMode;
  }, [fineMode]);

  // 핸들 위치(% 기준)에 따라 자동 확장/축소
  useEffect(() => {
    const bedPct = hourToPercent(bedTimeHour, expanded);
    const outPct = hourToPercent(outOfBedHour, expanded);
    const maxPct = Math.max(bedPct, outPct);
    if (!expanded && maxPct >= EXPAND_THRESHOLD) setExpanded(true);
    else if (expanded && maxPct <= COLLAPSE_THRESHOLD) setExpanded(false);
  }, [bedTimeHour, outOfBedHour, expanded]);

  const beginHandlePress = (
    clientX: number,
    clientY: number,
    point: "bed" | "out",
    hour: number,
  ) => {
    setDraggingPoint(point);
    startPosRef.current = { x: clientX, y: clientY };
    if (longPressTimerRef.current)
      clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      if (startPosRef.current) {
        navigator.vibrate?.(30);
        setFineOrigin(hourToPercent(hour, expandedRef.current));
        setFineMode(point);
      }
    }, 800);
  };

  useEffect(() => {
    if (!draggingPoint) return;

    const updateFromY = (clientX: number, clientY: number) => {
      // long-press 취소: 큰 움직임 감지
      if (startPosRef.current && longPressTimerRef.current) {
        const dx = clientX - startPosRef.current.x;
        const dy = clientY - startPosRef.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      let newHour = ratioToHour(ratio, expandedRef.current);
      if (fineModeRef.current) {
        newHour = Math.round(newHour * 60) / 60; // 1분 단위 스냅
      } else {
        newHour = Math.round(newHour * 12) / 12; // 5분 단위 스냅
      }
      if (draggingPoint === "bed") setBedTimeHour(newHour);
      else if (draggingPoint === "out") setOutOfBedHour(newHour);
    };

    const handleMouseMove = (e: MouseEvent) => updateFromY(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updateFromY(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      startPosRef.current = null;
      setDraggingPoint(null);
      setFineMode(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [draggingPoint, setBedTimeHour, setOutOfBedHour]);

  const formatTimeShort = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h < 12 ? "오전" : "오후";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0
      ? `${period} ${displayHour}시`
      : `${period} ${displayHour}시 ${String(m).padStart(2, "0")}분`;
  };

  const calculateInBedDuration = () => {
    let duration = outOfBedHour - bedTimeHour;
    if (duration < 0) duration += 24;
    return duration;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* 타이틀 + 총 시간만 */}
      <div className="flex flex-col gap-[8px] items-center w-full">
        <h2 className="text-white text-[20px] font-bold">
          침대에 있었던 시간
        </h2>
        <p className="text-[rgba(255,255,255,0.6)] text-[13px]">
          총 {Math.floor(calculateInBedDuration())}시간{" "}
          {Math.round(
            (calculateInBedDuration() -
              Math.floor(calculateInBedDuration())) *
              60,
          )}분
        </p>
      </div>

      {/* Vertical Timeline */}
      <div className="w-full mt-6">
        <div
          className="relative w-full ease-out"
          style={{
            height: expanded ? 552 : 460,
            transition: "height 300ms ease-out",
          }}
          ref={sliderRef}
        >
          {/* Time markers (right side) */}
          <div
            className="absolute left-[55%] ml-[46px] flex flex-col justify-between pl-4 text-left pointer-events-none transition-[height] duration-300 ease-out"
            style={{ height: expanded ? 552 : 460 }}
          >
            {(expanded ? EXPANDED_MARKERS : COLLAPSED_MARKERS).map((label, idx) => (
              <div
                key={idx}
                className="text-[11px] text-[rgba(255,255,255,0.4)] leading-none"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Track - 중앙 정렬 */}
          <div
            className="absolute left-[55%] -translate-x-1/2 w-[60px] transition-[height] duration-300 ease-out"
            style={{ height: expanded ? 552 : 460 }}
          >
            {/* Background track */}
            <div className="absolute inset-0 bg-[rgba(255,255,255,0.1)] pointer-events-none" />

            {/* Hour ticks */}
            {Array.from({ length: (expanded ? EXPANDED_RANGE : COLLAPSED_RANGE) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 w-full h-[1px] bg-[rgba(255,255,255,0.2)] pointer-events-none"
                style={{
                  top: `${(i / (expanded ? EXPANDED_RANGE : COLLAPSED_RANGE)) * 100}%`,
                  opacity: i % 4 === 0 ? 1 : 0.5,
                }}
              />
            ))}

            {/* In bed period bar */}
            <div
              className="absolute left-0 w-full bg-gray-500 bg-opacity-30 pointer-events-none"
              style={{
                top: `${Math.min(hourToPercent(bedTimeHour, expanded), hourToPercent(outOfBedHour, expanded))}%`,
                bottom: `${100 - Math.max(hourToPercent(bedTimeHour, expanded), hourToPercent(outOfBedHour, expanded))}%`,
              }}
            />

            {/* Bed time stroke */}
            <div
              className="absolute left-0 w-full h-[2px] bg-gray-400 pointer-events-none z-40 -translate-y-1/2"
              style={{ top: `${hourToPercent(bedTimeHour, expanded)}%` }}
            />

            {/* Bed time label (left side) - 줌인 시 inverse scale로 원래 크기 유지 */}
            <div
              className="absolute z-40"
              style={{
                top: `${hourToPercent(bedTimeHour, expanded)}%`,
                right: "100%",
                paddingRight: "8px",
                transform: fineMode ? "translateY(-50%) scale(0.5)" : "translateY(-50%)",
                transformOrigin: "right center",
                transition: "transform 200ms ease-out",
              }}
            >
              <EditableTimeChip
                label="침대에 누운 시각"
                icon="🛏️"
                hour={bedTimeHour}
                onChange={setBedTimeHour}
              />
            </div>

            {/* Bed time handle (right side) - hit area 확대 */}
            <div
              className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-50 p-3"
              style={{
                top: `${hourToPercent(bedTimeHour, expanded)}%`,
                left: "100%",
                marginLeft: "-12px",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginHandlePress(e.clientX, e.clientY, "bed", bedTimeHour);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginHandlePress(e.touches[0].clientX, e.touches[0].clientY, "bed", bedTimeHour);
              }}
            >
              <div className="flex items-center">
                <div className="h-[2px] w-[40px] bg-gray-400" />
                <div
                  className="bg-[#2D3748] border-gray-400 rounded-full shadow-lg select-none"
                  style={{
                    width: fineMode === "bed" ? 24 : 16,
                    height: fineMode === "bed" ? 24 : 16,
                    borderWidth: fineMode === "bed" ? 3 : 2,
                    borderStyle: "solid",
                    transition: "width 200ms, height 200ms, border-width 200ms",
                  }}
                />
              </div>
            </div>

            {/* Out of bed time stroke */}
            <div
              className="absolute left-0 w-full h-[2px] bg-gray-400 pointer-events-none z-40 -translate-y-1/2"
              style={{ top: `${hourToPercent(outOfBedHour, expanded)}%` }}
            />

            {/* Out of bed time label (left side) - 줌인 시 inverse scale */}
            <div
              className="absolute z-40"
              style={{
                top: `${hourToPercent(outOfBedHour, expanded)}%`,
                right: "100%",
                paddingRight: "8px",
                transform: fineMode ? "translateY(-50%) scale(0.5)" : "translateY(-50%)",
                transformOrigin: "right center",
                transition: "transform 200ms ease-out",
              }}
            >
              <EditableTimeChip
                label="침대에서 일어나 나온 시각"
                icon="🚶"
                hour={outOfBedHour}
                onChange={setOutOfBedHour}
              />
            </div>

            {/* Out of bed time handle (right side) - hit area 확대 */}
            <div
              className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-50 p-3"
              style={{
                top: `${hourToPercent(outOfBedHour, expanded)}%`,
                left: "100%",
                marginLeft: "-12px",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginHandlePress(e.clientX, e.clientY, "out", outOfBedHour);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginHandlePress(e.touches[0].clientX, e.touches[0].clientY, "out", outOfBedHour);
              }}
            >
              <div className="flex items-center">
                <div className="h-[2px] w-[40px] bg-gray-400" />
                <div
                  className="bg-[#2D3748] border-gray-400 rounded-full shadow-lg select-none"
                  style={{
                    width: fineMode === "out" ? 24 : 16,
                    height: fineMode === "out" ? 24 : 16,
                    borderWidth: fineMode === "out" ? 3 : 2,
                    borderStyle: "solid",
                    transition: "width 200ms, height 200ms, border-width 200ms",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SleepAttemptStep({
  sleepAttemptHour,
  setSleepAttemptHour,
  bedTimeHour,
  outOfBedHour,
  formatHourToTime,
}: {
  sleepAttemptHour: number;
  setSleepAttemptHour: (h: number) => void;
  bedTimeHour: number;
  outOfBedHour: number;
  formatHourToTime: (h: number) => string;
}) {
  const [draggingPoint, setDraggingPoint] = useState<
    string | null
  >(null);
  const [fineMode, setFineMode] = useState<string | null>(null);
  const [fineOrigin, setFineOrigin] = useState(0);
  const [nudgeAnim, setNudgeAnim] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const fineModeRef = useRef<string | null>(null);
  // 5단계 시퀀스: 0=초기, 1=첫끝마커, 2=바확장, 3=눈금+중간마커, 4=핸들
  const [animPhase, setAnimPhase] = useState(0);
  useEffect(() => {
    fineModeRef.current = fineMode;
  }, [fineMode]);
  useEffect(() => {
    const timers: number[] = [];
    // phase 0 → 1: 첫/끝 마커 표시
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimPhase(1));
    });
    // phase 1 → 2: 바 확장 (첫끝마커 표시 400ms 후)
    timers.push(window.setTimeout(() => setAnimPhase(2), 450));
    // phase 2 → 3: 눈금 + 중간 마커 (확장 500ms 후)
    timers.push(window.setTimeout(() => setAnimPhase(3), 1000));
    // phase 3 → 4: 핸들 표시
    timers.push(window.setTimeout(() => setAnimPhase(4), 1250));
    // phase 4 이후 1.5초 뒤 nudge 어포던스
    timers.push(window.setTimeout(() => setNudgeAnim(true), 2700));
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);

  // 이전 스텝(글로벌 타임라인)에서의 bed/out 위치 → zoom-in 시작점
  const bedPctGlobal = hourToPercent(bedTimeHour, false);
  const outPctGlobal = hourToPercent(outOfBedHour, false);
  const initHeight = ((outPctGlobal - bedPctGlobal) / 100) * 460;
  const initTop = (bedPctGlobal / 100) * 460;

  // bedTimeHour ~ outOfBedHour 범위에 맞춘 로컬 매핑
  const bedRange = ((outOfBedHour - bedTimeHour + 24) % 24) || 24;
  const localHourToPct = (hour: number) => {
    const offset = (hour - bedTimeHour + 24) % 24;
    return Math.min(100, Math.max(0, (offset / bedRange) * 100));
  };
  const localRatioToHour = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    return (clamped * bedRange + bedTimeHour) % 24;
  };

  const beginHandlePress = (
    clientX: number,
    clientY: number,
    hour: number,
  ) => {
    setDraggingPoint("attempt");
    startPosRef.current = { x: clientX, y: clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      if (startPosRef.current) {
        navigator.vibrate?.(30);
        setFineOrigin(localHourToPct(hour));
        setFineMode("attempt");
      }
    }, 800);
  };

  useEffect(() => {
    if (!draggingPoint) return;

    const updateFromY = (clientX: number, clientY: number) => {
      if (startPosRef.current && longPressTimerRef.current) {
        const dx = clientX - startPosRef.current.x;
        const dy = clientY - startPosRef.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      let newHour = localRatioToHour(ratio);
      if (fineModeRef.current) {
        newHour = Math.round(newHour * 60) / 60; // 1분 단위 스냅
      } else {
        newHour = Math.round(newHour * 12) / 12; // 5분 단위 스냅
      }

      // Clamp to bed time range
      const bedRef = 0;
      const outRef = (outOfBedHour - bedTimeHour + 24) % 24;
      const newRef = (newHour - bedTimeHour + 24) % 24;
      const clampedRef = Math.max(bedRef, Math.min(outRef, newRef));
      newHour = (clampedRef + bedTimeHour) % 24;
      setSleepAttemptHour(newHour);
    };

    const handleMouseMove = (e: MouseEvent) => updateFromY(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updateFromY(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      startPosRef.current = null;
      setDraggingPoint(null);
      setFineMode(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [draggingPoint, setSleepAttemptHour]);

  const formatTimeShort = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h < 12 ? "오전" : "오후";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0
      ? `${period} ${displayHour}시`
      : `${period} ${displayHour}시 ${String(m).padStart(2, "0")}분`;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* 타이틀만 */}
      <div className="flex flex-col items-center w-full">
        <h2 className="text-white text-[20px] font-bold">
          잠을 자려고 시도한 시각은?
        </h2>
      </div>

      {/* Vertical Timeline - 5단계 시퀀셜 애니메이션 */}
      <div className="w-full mt-8" style={{ height: 460, position: "relative" }}>
        <div
          className="absolute left-0 right-0 w-full overflow-visible"
          style={{
            height: animPhase >= 2 ? 460 : initHeight,
            top: animPhase >= 2 ? 0 : initTop,
            transform: fineMode ? "scale(2)" : "scale(1)",
            transformOrigin: `55% ${fineOrigin}%`,
            transition: `${animPhase >= 2 ? "height 500ms cubic-bezier(0.4, 0, 0.2, 1), top 500ms cubic-bezier(0.4, 0, 0.2, 1), " : ""}transform 200ms ease-out`,
          }}
          ref={sliderRef}
        >
          {/* All time markers (right side of bar) - 첫/끝은 phase 1, 중간은 phase 3 */}
          <div
            className="absolute left-[55%] ml-[46px] flex flex-col justify-between pl-4 text-left pointer-events-none"
            style={{ height: "100%" }}
          >
            {(() => {
              const count = 5;
              const markers: { time: string; label?: string; isEdge: boolean }[] = [];
              for (let i = 0; i < count; i++) {
                const hour = (bedTimeHour + (bedRange * i) / (count - 1)) % 24;
                markers.push({
                  time: formatTimeShort(hour),
                  label: i === 0 ? "침대에 누운 시각" : i === count - 1 ? "침대에서 일어나 나온 시각" : undefined,
                  isEdge: i === 0 || i === count - 1,
                });
              }
              return markers;
            })().map((m, idx, arr) => (
              <div
                key={idx}
                className="flex flex-col gap-0.5 whitespace-nowrap"
                style={{
                  opacity: m.isEdge ? (animPhase >= 1 ? 1 : 0) : (animPhase >= 3 ? 1 : 0),
                  transition: "opacity 300ms ease-out",
                }}
              >
                {m.label && (
                  <span className="text-[9px] text-white/40 leading-none">{m.label}</span>
                )}
                <span className={`text-[11px] leading-none ${m.isEdge ? "text-white/70 font-medium" : "text-[rgba(255,255,255,0.4)]"}`}>
                  {m.time}
                </span>
              </div>
            ))}
          </div>

          {/* Track - 중앙 정렬 */}
          <div
            className="absolute left-[55%] -translate-x-1/2 w-[60px] cursor-pointer"
            style={{ height: "100%" }}
            onMouseDown={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
              let newHour = localRatioToHour(ratio);
              newHour = Math.round(newHour * 12) / 12;
              setSleepAttemptHour(newHour);
              setDraggingPoint("attempt");
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.touches[0].clientY - rect.top) / rect.height));
              let newHour = localRatioToHour(ratio);
              newHour = Math.round(newHour * 12) / 12;
              setSleepAttemptHour(newHour);
              setDraggingPoint("attempt");
            }}
          >
            {/* Background track (전체 = in bed 영역) */}
            <div className="absolute inset-0 bg-[#494D58] pointer-events-none" />

            {/* Hour ticks (phase 3에서 페이드인, sleepAttempt 근처 숨김) */}
            {Array.from({ length: Math.ceil(bedRange) + 1 }, (_, i) => {
              const tickPct = (i / bedRange) * 100;
              const attemptPct = localHourToPct(sleepAttemptHour);
              const tooClose = Math.abs(tickPct - attemptPct) < 2 || tickPct < 0.5 || tickPct > 99.5;
              if (tooClose) return null;
              return (
                <div
                  key={i}
                  className="absolute left-0 w-full h-[1px] bg-[rgba(255,255,255,0.2)] pointer-events-none"
                  style={{
                    top: `${tickPct}%`,
                    opacity: animPhase >= 3 ? (i % 4 === 0 ? 1 : 0.5) : 0,
                    transition: "opacity 300ms ease-out",
                  }}
                />
              );
            })}

            {/* Sleep attempt group: stroke + label + handle 함께 움직임 */}
            <div
              className="absolute left-0 right-0 z-40"
              style={{
                top: `${localHourToPct(sleepAttemptHour)}%`,
                opacity: animPhase >= 4 ? 1 : 0,
                transition: "opacity 300ms ease-out",
                animation: nudgeAnim && !hasDragged ? "nudgeDown 1s ease-in-out infinite" : "none",
              }}
            >
              {/* Stroke */}
              <div className="absolute left-0 w-full h-[2px] bg-gray-400 -translate-y-1/2 pointer-events-none" />

              {/* Label (left side) */}
              <div
                className="absolute z-40"
                style={{
                  right: "100%",
                  paddingRight: "8px",
                  transform: fineMode ? "translateY(-50%) scale(0.5)" : "translateY(-50%)",
                  transformOrigin: "right center",
                  transition: "transform 200ms ease-out",
                  maxWidth: "calc(55vw - 60px)",
                }}
              >
                <EditableTimeChip
                  label="잠을 자려고 시도"
                  icon="💤"
                  hour={sleepAttemptHour}
                  onChange={(h) => setSleepAttemptHour(clampHourInRange(h, bedTimeHour, outOfBedHour))}
                  minWidth={100}
                />
              </div>

              {/* Handle (right side) */}
              <div
                className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-50 p-4"
                style={{
                  left: "100%",
                  marginLeft: "-16px",
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHasDragged(true);
                  setNudgeAnim(false);
                  beginHandlePress(e.clientX, e.clientY, sleepAttemptHour);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHasDragged(true);
                  setNudgeAnim(false);
                  beginHandlePress(e.touches[0].clientX, e.touches[0].clientY, sleepAttemptHour);
                }}
              >
                <div className="flex items-center">
                  <div className="h-[2px] w-[40px] bg-gray-400" />
                  <div
                    className="bg-[#2D3748] border-gray-400 rounded-full shadow-lg select-none"
                    style={{
                      width: fineMode ? 28 : 20,
                      height: fineMode ? 28 : 20,
                      borderWidth: fineMode ? 4 : 3,
                      borderStyle: "solid",
                      transition: "width 200ms, height 200ms, border-width 200ms",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SleepWakeTimeStep({
  sleepTimeHour,
  setSleepTimeHour,
  wakeTimeHour,
  setWakeTimeHour,
  bedTimeHour,
  outOfBedHour,
  sleepAttemptHour,
  formatHourToTime,
  calculateSleepDuration,
}: {
  sleepTimeHour: number;
  setSleepTimeHour: (h: number) => void;
  wakeTimeHour: number;
  setWakeTimeHour: (h: number) => void;
  bedTimeHour: number;
  outOfBedHour: number;
  sleepAttemptHour: number;
  formatHourToTime: (h: number) => string;
  calculateSleepDuration: () => number;
}) {
  const [draggingPoint, setDraggingPoint] = useState<
    string | null
  >(null);
  const [fineMode, setFineMode] = useState<string | null>(null);
  const [fineOrigin, setFineOrigin] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const fineModeRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    fineModeRef.current = fineMode;
  }, [fineMode]);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // bedTimeHour ~ outOfBedHour 범위에 맞춘 로컬 매핑
  const bedRange = ((outOfBedHour - bedTimeHour + 24) % 24) || 24;
  const localHourToPct = (hour: number) => {
    const offset = (hour - bedTimeHour + 24) % 24;
    return Math.min(100, Math.max(0, (offset / bedRange) * 100));
  };
  const localRatioToHour = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    return (clamped * bedRange + bedTimeHour) % 24;
  };

  const beginHandlePress = (
    clientX: number,
    clientY: number,
    point: "sleep" | "wake",
    hour: number,
  ) => {
    setDraggingPoint(point);
    startPosRef.current = { x: clientX, y: clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      if (startPosRef.current) {
        navigator.vibrate?.(30);
        setFineOrigin(localHourToPct(hour));
        setFineMode(point);
      }
    }, 800);
  };

  useEffect(() => {
    if (!draggingPoint) return;

    const updateFromY = (clientX: number, clientY: number) => {
      if (startPosRef.current && longPressTimerRef.current) {
        const dx = clientX - startPosRef.current.x;
        const dy = clientY - startPosRef.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      let newHour = localRatioToHour(ratio);
      if (fineModeRef.current) {
        newHour = Math.round(newHour * 60) / 60; // 1분 단위 스냅
      } else {
        newHour = Math.round(newHour * 12) / 12; // 5분 단위 스냅
      }

      const bedRef = (bedTimeHour - bedTimeHour + 24) % 24;
      const outRef = (outOfBedHour - bedTimeHour + 24) % 24;
      const sleepAttemptRef = (sleepAttemptHour - bedTimeHour + 24) % 24;
      const newRef = (newHour - bedTimeHour + 24) % 24;

      let clampedRef = Math.max(bedRef, Math.min(outRef, newRef));
      if (draggingPoint === "sleep") {
        clampedRef = Math.max(sleepAttemptRef, Math.min(outRef, clampedRef));
      }
      newHour = (clampedRef + bedTimeHour) % 24;

      if (draggingPoint === "sleep") setSleepTimeHour(newHour);
      else if (draggingPoint === "wake") setWakeTimeHour(newHour);
    };

    const handleMouseMove = (e: MouseEvent) => updateFromY(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updateFromY(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      startPosRef.current = null;
      setDraggingPoint(null);
      setFineMode(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [
    draggingPoint,
    setSleepTimeHour,
    setWakeTimeHour,
    bedTimeHour,
    outOfBedHour,
    sleepAttemptHour,
  ]);

  const sleepDuration = calculateSleepDuration();

  const formatTimeShort = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h < 12 ? "오전" : "오후";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0
      ? `${period} ${displayHour}시`
      : `${period} ${displayHour}시 ${String(m).padStart(2, "0")}분`;
  };

  // bedTimeHour ~ outOfBedHour 범위를 4등분하여 마커 생성 (sleepAttempt 근처 숨김)
  const makeMarkers = () => {
    const count = 5;
    const attemptPct = localHourToPct(sleepAttemptHour);
    const markers: { time: string; label?: string; hidden: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const pct = (i / (count - 1)) * 100;
      const hour = (bedTimeHour + (bedRange * i) / (count - 1)) % 24;
      const tooClose = Math.abs(pct - attemptPct) < 8;
      markers.push({
        time: formatTimeShort(hour),
        label: i === 0 ? "침대에 누운 시각" : i === count - 1 ? "침대에서 일어나 나온 시각" : undefined,
        hidden: tooClose,
      });
    }
    return markers;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* 타이틀 + 총 수면 시간만 */}
      <div className="flex flex-col gap-[8px] items-center w-full">
        <h2 className="text-white text-[20px] font-bold">
          실제로 주무신 시간은?
        </h2>
        <p className="text-[rgba(255,255,255,0.6)] text-[13px]">
          총 수면 시간 {Math.floor(sleepDuration)}시간{" "}
          {Math.round(
            (sleepDuration - Math.floor(sleepDuration)) * 60,
          )}분
        </p>
      </div>

      {/* Vertical Timeline */}
      <div className="w-full mt-6">
        <div
          className="relative w-full ease-out"
          style={{
            height: 460,
            transform: fineMode ? "scale(2)" : "scale(1)",
            transformOrigin: `55% ${fineOrigin}%`,
            transition: "transform 200ms ease-out",
          }}
          ref={sliderRef}
        >
          {/* Time markers (right side of bar) */}
          <div
            className="absolute left-[55%] ml-[46px] flex flex-col justify-between pl-4 text-left pointer-events-none"
            style={{ height: 460 }}
          >
            {makeMarkers().map((m, idx, arr) => (
              <div key={idx} className="flex flex-col gap-0.5 whitespace-nowrap" style={{ visibility: m.hidden ? "hidden" : "visible" }}>
                {m.label && (
                  <span className="text-[9px] text-white/40 leading-none">{m.label}</span>
                )}
                <span className={`text-[11px] leading-none ${idx === 0 || idx === arr.length - 1 ? "text-white/70 font-medium" : "text-[rgba(255,255,255,0.4)]"}`}>
                  {m.time}
                </span>
              </div>
            ))}
          </div>

          {/* 잠을 자려고 시도한 시각 표시 (right side) */}
          <div
            className="absolute left-[55%] ml-[46px] pl-4 text-left pointer-events-none"
            style={{
              top: `${localHourToPct(sleepAttemptHour)}%`,
              transform: "translateY(-50%)",
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-white/40 leading-none">잠을 자려고 시도한 시각</span>
              <span className="text-[11px] text-gray-400 font-medium leading-none">{formatTimeShort(sleepAttemptHour)}</span>
            </div>
          </div>

          {/* Track - 중앙 정렬 */}
          <div
            className="absolute left-[55%] -translate-x-1/2 w-[60px]"
            style={{ height: 460 }}
          >
            {/* In bed period bar (background - gray) */}
            <div className="absolute inset-0 bg-[#494D58] pointer-events-none" />

            {/* Hour ticks (sleepAttemptHour, bedTime, outOfBed 근처 숨김) */}
            {Array.from({ length: Math.ceil(bedRange) + 1 }, (_, i) => {
              const tickPct = (i / bedRange) * 100;
              const attemptPct = localHourToPct(sleepAttemptHour);
              const tooClose = Math.abs(tickPct - attemptPct) < 2 || tickPct < 0.5 || tickPct > 99.5;
              if (tooClose) return null;
              return (
                <div
                  key={i}
                  className="absolute left-0 w-full h-[1px] bg-[rgba(255,255,255,0.35)] pointer-events-none z-10"
                  style={{
                    top: `${tickPct}%`,
                    opacity: i % 4 === 0 ? 1 : 0.5,
                  }}
                />
              );
            })}

            {/* Trying to sleep period bar (SL 영역 - amber) */}
            <div
              className="absolute left-0 w-full pointer-events-none"
              style={{
                backgroundColor: "rgba(251, 191, 36, 0.3)",
                top: `${Math.min(localHourToPct(sleepAttemptHour), localHourToPct(sleepTimeHour))}%`,
                bottom: `${100 - Math.max(localHourToPct(sleepAttemptHour), localHourToPct(sleepTimeHour))}%`,
              }}
            />

            {/* Sleep period bar */}
            <div
              className="absolute left-0 w-full bg-blue-400 pointer-events-none"
              style={{
                top: `${Math.min(localHourToPct(sleepTimeHour), localHourToPct(wakeTimeHour))}%`,
                bottom: `${100 - Math.max(localHourToPct(sleepTimeHour), localHourToPct(wakeTimeHour))}%`,
              }}
            />

            {/* Sleep time stroke - amber, 핸들 박스에 통합 */}

            {/* Sleep latency bracket + duration label */}
            {(() => {
              const attemptPct = localHourToPct(sleepAttemptHour);
              const sleepPct = localHourToPct(sleepTimeHour);
              const topPct = Math.min(attemptPct, sleepPct);
              const bottomPct = Math.max(attemptPct, sleepPct);
              const midPct = (topPct + bottomPct) / 2;
              const latencyMin = ((sleepTimeHour - sleepAttemptHour + 24) % 24) * 60;
              if (latencyMin < 1) return null;
              return (
                <>
                  {/* Bracket line connecting start and end (left side, ticks toward bar) */}
                  <div
                    className="absolute pointer-events-none z-30"
                    style={{
                      top: `${topPct}%`,
                      height: `${bottomPct - topPct}%`,
                      right: "100%",
                      marginRight: "18px",
                      width: "12px",
                    }}
                  >
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="0" y2="100%" stroke="rgba(251,191,36,0.4)" strokeWidth="1" />
                      <line x1="0" y1="0" x2="6" y2="0" stroke="rgba(251,191,36,0.4)" strokeWidth="1" />
                      <line x1="0" y1="100%" x2="6" y2="100%" stroke="rgba(251,191,36,0.4)" strokeWidth="1" />
                    </svg>
                  </div>
                  {/* Duration card at midpoint (left side) */}
                  <div
                    className="absolute z-30 pointer-events-none"
                    style={{
                      top: `${midPct}%`,
                      right: "100%",
                      paddingRight: "34px",
                      transform: fineMode ? "translateY(-50%) scale(0.5)" : "translateY(-50%)",
                      transformOrigin: "right center",
                      transition: "transform 200ms ease-out",
                    }}
                  >
                    <div className="bg-[#2D3748] border border-amber-400/40 px-3 py-2 rounded-lg text-white whitespace-nowrap select-none flex flex-col items-start gap-1 shadow-lg min-w-[90px]">
                      <span className="text-[10px] text-amber-400/70 leading-none">입면지연시간</span>
                      <span className="text-[13px] font-bold text-amber-300 leading-none flex items-center gap-1.5">
                        <span>⏱️</span>
                        <span>{formatLatency(latencyMin)}</span>
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Sleep time handle - amber chevron */}
            <div
              className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-50"
              style={{
                top: `${localHourToPct(sleepTimeHour)}%`,
                right: "-8px",
                left: "-8px",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginHandlePress(e.clientX, e.clientY, "sleep", sleepTimeHour);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginHandlePress(e.touches[0].clientX, e.touches[0].clientY, "sleep", sleepTimeHour);
              }}
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* amber 가로선 (중앙) */}
                <div className="absolute left-0 right-0 h-[2px] bg-amber-400 top-1/2 -translate-y-1/2" />
                {/* Chevron */}
                <div className="relative flex flex-col items-center gap-[2px] py-[4px]">
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <path d="M4 8L12 2L20 8" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <path d="M4 2L12 8L20 2" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Wake group: stroke + label + handle 함께 움직임 */}
            <div
              className="absolute left-0 right-0 z-40"
              style={{ top: `${localHourToPct(wakeTimeHour)}%` }}
            >
              {/* Stroke */}
              <div className="absolute left-0 w-full h-[2px] bg-sky-300 -translate-y-1/2 pointer-events-none" />

              {/* Label (left side) */}
              <div
                className="absolute z-40"
                style={{
                  right: "100%",
                  paddingRight: "8px",
                  transform: fineMode ? "translateY(-50%) scale(0.5)" : "translateY(-50%)",
                  transformOrigin: "right center",
                  transition: "transform 200ms ease-out",
                  maxWidth: "calc(55vw - 60px)",
                }}
              >
                <EditableTimeChip
                  label="잠에서 깬 시각"
                  icon="⏰"
                  hour={wakeTimeHour}
                  onChange={(h) => setWakeTimeHour(clampHourInRange(h, bedTimeHour, outOfBedHour))}
                  minWidth={100}
                />
              </div>

              {/* Handle (right side) */}
              <div
                className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-50 p-3"
                style={{ left: "100%", marginLeft: "-12px" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginHandlePress(e.clientX, e.clientY, "wake", wakeTimeHour);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginHandlePress(e.touches[0].clientX, e.touches[0].clientY, "wake", wakeTimeHour);
                }}
              >
                <div className="flex items-center">
                  <div className="h-[2px] w-[40px] bg-sky-300" />
                  <div
                    className="bg-[#1a1a2e] border-sky-300 rounded-full select-none"
                    style={{
                      width: fineMode === "wake" ? 24 : 18,
                      height: fineMode === "wake" ? 24 : 18,
                      borderWidth: fineMode === "wake" ? 3 : 2.5,
                      borderStyle: "solid",
                      transition: "width 200ms, height 200ms, border-width 200ms",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WakeEventsStep({
  wakeCount,
  setWakeCount,
  wakeTotalMinutes,
  setWakeTotalMinutes,
  wakeSubStep,
  setWakeSubStep,
  onYes,
  onNo,
}: {
  wakeCount: number;
  setWakeCount: (count: number) => void;
  wakeTotalMinutes: number;
  setWakeTotalMinutes: (minutes: number) => void;
  wakeSubStep: number;
  setWakeSubStep: (step: number) => void;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-start relative w-full my-auto">
      {/* 초기 질문 */}
      {(wakeSubStep === 0 || wakeSubStep === -1) && (
        <>
          <div className="text-center w-full">
            <h2 className="text-white text-[20px] font-bold mb-2">
              밤중에 깬 적이 있나요?
            </h2>
            {wakeSubStep === -1 && (
              <p className="text-[rgba(255,255,255,0.6)] text-[13px] mt-2">
                깬 적 없이 잤습니다
              </p>
            )}
          </div>
          {wakeSubStep === 0 && (
            <div className="flex flex-col gap-4 w-full items-center">
              <button
                onClick={onYes}
                className="w-full bg-[rgba(255,255,255,0.9)] hover:bg-white py-4 rounded-lg text-[#121216] text-[16px] font-semibold transition-all"
              >
                네, 깬 적이 있어요
              </button>
              <button
                onClick={onNo}
                className="w-full bg-transparent border border-[rgba(255,255,255,0.25)] hover:border-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.05)] py-4 rounded-lg text-white/80 text-[16px] font-semibold transition-all"
              >
                아니요, 깬 적 없어요
              </button>
            </div>
          )}
        </>
      )}

      {/* 몇 번 깼나요? */}
      {wakeSubStep === 1 && (
        <>
          <div className="text-center w-full">
            <h2 className="text-white text-[20px] font-bold mb-2">
              몇 번 깼나요?
            </h2>
          </div>
          <div className="flex items-center justify-center gap-6 w-full">
            <button
              onClick={() => setWakeCount(Math.max(1, (wakeCount || 1) - 1))}
              disabled={(wakeCount || 1) <= 1}
              aria-label="감소"
              className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[28px] font-bold transition-all flex items-center justify-center select-none"
            >
              −
            </button>
            <div className="flex flex-col items-center min-w-[100px]">
              <span className="text-white text-[56px] font-bold leading-none">
                {wakeCount || 1}
              </span>
              <span className="text-white/50 text-[14px] mt-1">번</span>
            </div>
            <button
              onClick={() => setWakeCount((wakeCount || 0) + 1)}
              aria-label="증가"
              className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-[28px] font-bold transition-all flex items-center justify-center select-none"
            >
              +
            </button>
          </div>
        </>
      )}

      {/* 깬 시간의 총 합은 몇 분인가요? */}
      {wakeSubStep === 2 && (
        <>
          <div className="text-center w-full mb-4">
            <p className="text-[rgba(255,255,255,0.6)] text-[13px] mb-2">
              밤중에 {wakeCount}번 깨셨군요
            </p>
            <h2 className="text-white text-[20px] font-bold">
              깬 시간의 총 합은 몇 분인가요?
            </h2>
          </div>
          <WheelPicker
            value={wakeTotalMinutes}
            onChange={setWakeTotalMinutes}
            values={WAKE_MINUTE_VALUES}
            formatLabel={formatWakeMinutes}
          />
        </>
      )}
    </div>
  );
}

function WheelPicker({
  value,
  onChange,
  values,
  formatLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  values: number[];
  formatLabel?: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const itemHeight = 50;
  const visibleItems = 5;
  const containerHeight = itemHeight * visibleItems;

  const centerOffset = itemHeight * Math.floor(visibleItems / 2);

  useEffect(() => {
    if (containerRef.current) {
      const index = values.indexOf(value);
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(
      0,
      Math.min(values.length - 1, index),
    );
    if (values[clampedIndex] !== value) {
      onChange(values[clampedIndex]);
    }
  };

  useEffect(() => {
    if (!containerRef.current || isDragging) return;

    const index = values.indexOf(value);
    if (index !== -1) {
      containerRef.current.scrollTo({
        top: index * itemHeight,
        behavior: "smooth",
      });
    }
  }, [value, isDragging]);

  return (
    <div className="relative w-full flex items-center justify-center">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        className="overflow-y-scroll scrollbar-hide relative"
        style={{
          height: `${containerHeight}px`,
          scrollSnapType: "y mandatory",
          // 위/아래로 흐려지는 wheel picker 느낌
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)",
        }}
      >
        <div style={{ height: `${centerOffset}px` }} />
        {values.map((v) => {
          const index = values.indexOf(v);
          const selectedIndex = values.indexOf(value);
          const distance = Math.abs(index - selectedIndex);
          return (
            <div
              key={v}
              onClick={() => onChange(v)}
              className="flex items-center justify-center cursor-pointer transition-all"
              style={{
                height: `${itemHeight}px`,
                scrollSnapAlign: "start",
                opacity: v === value ? 1 : Math.max(0.2, 0.6 - distance * 0.15),
                fontSize: v === value ? "24px" : "16px",
                color: "white",
                fontWeight: v === value ? "bold" : "normal",
                transform: v === value ? "scale(1)" : `scale(${Math.max(0.85, 1 - distance * 0.05)})`,
              }}
            >
              {formatLabel ? formatLabel(v) : `${v}`}
            </div>
          );
        })}
        <div style={{ height: `${centerOffset}px` }} />
      </div>

      {/* 선택 표시 라인 */}
      <div className="absolute top-1/2 -translate-y-1/2 w-full h-[50px] border-y border-[rgba(255,255,255,0.2)] pointer-events-none" />
    </div>
  );
}