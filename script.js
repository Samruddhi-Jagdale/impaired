// --- STATE & CONFIG ---
let currentRole = null;
let ttsEnabled = true;
let synth = window.speechSynthesis;
let speechRecognitionObj = null;
let navChart = null;
let cameraStream = null;
let detectionInterval = null;
let currentModel = null;

// Audio Context for beeps
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let signAnimationTimeout = null;

function playNotificationBeep(freq, type) {
    if(!ttsEnabled || currentRole === 'hearing') return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
        osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
}
function playSuccessBeep() { playNotificationBeep(880, 'sine'); }
function playErrorBeep() { playNotificationBeep(220, 'square'); }
function playActionBeep() { playNotificationBeep(600, 'sine'); }

// Voice command mapping (Hold Space)
let isListeningOnSpace = false;
let spaceSpeechRecognition = null;

function initSpacebarVoice() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRec) return;
    spaceSpeechRecognition = new SpeechRec();
    spaceSpeechRecognition.continuous = false;
    spaceSpeechRecognition.interimResults = false;
    
    spaceSpeechRecognition.onresult = (e) => {
        const cmd = e.results[0][0].transcript.toLowerCase().trim();
        console.log("Voice Command:", cmd);
        if(cmd.includes("next")) {
            next();
        } else if (cmd.includes("simplify")) {
            openNoteSimplifier();
        } else if (currentQuizActive) {
            if(cmd.includes("a") || cmd.includes("one")) handleQuizAnswer('A');
            else if (cmd.includes("b") || cmd.includes("two")) handleQuizAnswer('B');
        }
    };
}

document.addEventListener('keydown', (e) => {
    if(e.code === 'Space' && !isListeningOnSpace && currentRole === 'blind') {
        isListeningOnSpace = true;
        const badge = document.getElementById('voice-listening-badge');
        if(badge) badge.classList.remove('hidden');
        if(!spaceSpeechRecognition) initSpacebarVoice();
        if(spaceSpeechRecognition) {
            try { spaceSpeechRecognition.start(); } catch(err){}
        }
    }
});

document.addEventListener('keyup', (e) => {
    if(e.code === 'Space' && currentRole === 'blind') {
        isListeningOnSpace = false;
        const badge = document.getElementById('voice-listening-badge');
        if(badge) badge.classList.add('hidden');
        if(spaceSpeechRecognition) {
            try { spaceSpeechRecognition.stop(); } catch(err){}
        }
    }
});

function next() {
    announce("Next action triggered via voice command.");
    if(currentQuizActive) {
        currentQuestionIndex++;
        renderQuiz();
    }
}

// Vibrational / Mobile Shake Simulator
function triggerVibrationSim() {
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
    document.body.classList.add('flash-alert', 'quiz-shake');
    setTimeout(() => {
        document.body.classList.remove('flash-alert', 'quiz-shake');
    }, 1000);
}

// --- NAVIGATION LOGIC ---
function showRoleSelection() {
    document.getElementById('login-view').style.transform = 'translateY(-100%)';
    const rv = document.getElementById('role-view');
    rv.style.transform = 'translateY(0)';
    announce("Select Your Profile: Blind Student, Hearing Impaired, or System Admin.");
}

function initPortal(role) {
    currentRole = role;
    document.getElementById('role-view').style.transform = 'translateY(-100%)';
    const shell = document.getElementById('app-shell');
    shell.style.transform = 'translateX(0)';
    
    buildSidebar();
    buildDashboard();
    lucide.createIcons();

    if (role === 'blind') {
        announce("Welcome to the Blind Student Workspace. Voice control is active. Say 'Go to Quiz' or 'Object Description'.");
        startVoiceCommandSystem();
    } else if (role === 'hearing') {
        announce("Hearing Impaired Workspace loaded.");
    } else if (role === 'admin') {
        announce("System Administration loaded.");
    }
}

function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    let html = '';
    
    const navItemCls = "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors text-left focus-element hover:bg-slate-100 dark:hover:bg-slate-700/50 mb-1";
    
    html += `<button class="${navItemCls} bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold" onclick="buildDashboard()">
                <i data-lucide="layout"></i> Dashboard
             </button>`;
             
    if (currentRole === 'blind') {
        html += `<button class="${navItemCls}" onclick="openAudioQuiz()">
                    <i data-lucide="help-circle"></i> Audio Quiz
                 </button>`;
        html += `<button class="${navItemCls}" onclick="openObjectDescription()">
                    <i data-lucide="camera"></i> Object Scanner
                 </button>`;
        html += `<button class="${navItemCls}" onclick="openAudioDocumentReader()">
                    <i data-lucide="book-open"></i> Doc Reader
                 </button>`;
    } else if (currentRole === 'hearing') {
        html += `<button class="${navItemCls}" onclick="openVideoLesson()">
                    <i data-lucide="play-square"></i> Video Lessons
                 </button>`;
        html += `<button class="${navItemCls}" onclick="openSignDictionary()">
                    <i data-lucide="book-open"></i> Sign Language Dict
                 </button>`;
        html += `<button class="${navItemCls}" onclick="triggerVisualAlert()">
                    <i data-lucide="bell-ring"></i> Test Alert
                 </button>`;
        html += `<button class="${navItemCls}" onclick="openConceptVisualizer()">
                    <i data-lucide="share-2"></i> Concept Visualizer
                 </button>`;
    }

    if (currentRole !== 'admin') {
        html += `<button class="${navItemCls}" onclick="openNoteSimplifier()">
                    <i data-lucide="file-text"></i> AI Note Simplifier
                 </button>`;
    }
    
    // Add file upload for all
    html += `<button class="${navItemCls} bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-purple-700 dark:text-purple-300" onclick="openFileUpload()">
                <i data-lucide="upload-cloud"></i> Upload Materials
             </button>`;
    
    nav.innerHTML = html;
}

function buildDashboard() {
    const content = document.getElementById('dynamic-content');
    const title = document.getElementById('view-title');
    
    if (currentRole === 'blind') {
        title.innerText = "Blind Student Dashboard";
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                <button onclick="openAudioQuiz()" class="glass rounded-3xl p-10 shadow-lg border border-white/20 hover:border-indigo-500 hover:bg-white/40 flex flex-col items-center justify-center gap-4 text-2xl font-bold transition-all focus-element" aria-label="Start Audio Quiz Module">
                    <i data-lucide="mic" class="w-16 h-16 text-indigo-500 drop-shadow-md"></i>
                    Start Audio Quiz
                </button>
                <button onclick="openObjectDescription()" class="glass rounded-3xl p-10 shadow-lg border border-white/20 hover:border-purple-500 hover:bg-white/40 flex flex-col items-center justify-center gap-4 text-2xl font-bold transition-all focus-element" aria-label="Start Object Scanner Camera">
                    <i data-lucide="camera" class="w-16 h-16 text-purple-500 drop-shadow-md"></i>
                    Scan Objects
                </button>
                <button onclick="openAudioDocumentReader()" class="glass rounded-3xl p-10 shadow-lg border border-white/20 hover:border-pink-500 hover:bg-white/40 flex flex-col items-center justify-center gap-4 text-2xl font-bold transition-all focus-element" aria-label="Start Document Reader">
                    <i data-lucide="book-open" class="w-16 h-16 text-pink-500 drop-shadow-md"></i>
                    Read Document
                </button>
            </div>
        `;
    } else if (currentRole === 'hearing') {
        title.innerText = "Hearing Impaired Dashboard";
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Large Video Card -->
                <div class="col-span-1 md:col-span-2 glass rounded-3xl overflow-hidden relative shadow-lg aspect-video flex flex-col group cursor-pointer border-2 border-transparent hover:border-indigo-400 transition-all" onclick="openVideoLesson()">
                    <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=1200" alt="Students learning" class="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60 transition-transform duration-700 group-hover:scale-105">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-center justify-center">
                        <i data-lucide="play-circle" class="w-24 h-24 text-white opacity-90 group-hover:scale-110 transition-transform drop-shadow-2xl"></i>
                    </div>
                    <div class="absolute top-4 right-4 w-32 h-32 glass border border-white/20 rounded-full flex flex-col items-center justify-center text-white p-2 shadow-2xl animate-pulse">
                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=SignAI" class="w-16 h-16 mb-1" alt="AI Avatar">
                        <span class="text-xs font-bold font-mono bg-black/50 px-2 rounded-full">SIGN AI</span>
                    </div>
                    <div class="absolute bottom-6 left-6 text-white text-3xl font-bold drop-shadow-lg">
                        Cellular Biology 101
                    </div>
                </div>
                <!-- Action Cards -->
                <div class="flex flex-col gap-6">
                    <button onclick="openSignDictionary()" class="flex-1 glass bg-white/30 dark:bg-slate-800/50 rounded-3xl p-6 shadow-sm border border-white/40 hover:bg-white/60 hover:border-blue-400 transition-all focus-element flex flex-col items-center justify-center gap-4">
                        <div class="p-4 bg-blue-100 rounded-2xl shadow-inner"><i data-lucide="book" class="w-10 h-10 text-blue-600"></i></div>
                        <h3 class="font-bold text-xl text-slate-800 dark:text-white">Sign Dictionary</h3>
                    </button>
                    <button onclick="openConceptVisualizer()" class="flex-1 glass bg-white/30 dark:bg-slate-800/50 rounded-3xl p-6 shadow-sm border border-white/40 hover:bg-white/60 hover:border-emerald-400 transition-all focus-element flex flex-col items-center justify-center gap-4">
                        <div class="p-4 bg-emerald-100 rounded-2xl shadow-inner"><i data-lucide="git-merge" class="w-10 h-10 text-emerald-600"></i></div>
                        <h3 class="font-bold text-xl text-slate-800 dark:text-white">Concept Visualizer</h3>
                    </button>
                </div>
            </div>
        `;
    } else if (currentRole === 'admin') {
        title.innerText = "System Health & Analytics";
        content.innerHTML = `
            <div class="grid grid-cols-3 gap-6 mb-6">
                <div class="glass p-6 rounded-2xl shadow-lg border border-white/20 dark:border-slate-700 relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl"></div>
                    <h4 class="text-slate-600 dark:text-slate-400 font-medium mb-1 relative z-10">Active Users</h4>
                    <p class="text-4xl font-extrabold text-indigo-700 dark:text-indigo-400 relative z-10">1,248</p>
                </div>
                <div class="glass p-6 rounded-2xl shadow-lg border border-white/20 dark:border-slate-700 relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl"></div>
                    <h4 class="text-slate-600 dark:text-slate-400 font-medium mb-1 relative z-10">A11y Events</h4>
                    <p class="text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 relative z-10">84,392</p>
                </div>
                <div class="glass p-6 rounded-2xl shadow-lg border border-white/20 dark:border-slate-700 relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
                    <h4 class="text-slate-600 dark:text-slate-400 font-medium mb-1 relative z-10">Platform Uptime</h4>
                    <p class="text-4xl font-extrabold text-blue-700 dark:text-blue-400 relative z-10">99.99%</p>
                </div>
            </div>
            <div class="glass p-6 rounded-3xl shadow-lg border border-white/20 dark:border-slate-700 w-full h-[400px]">
                <canvas id="adminChart"></canvas>
            </div>
        `;
        setTimeout(initChart, 200);
    }
}

function initChart() {
    const ctx = document.getElementById('adminChart');
    if(!ctx) return;
    if(navChart) navChart.destroy();
    navChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Screen Reader Usage (hrs)',
                data: [120, 190, 150, 220, 180, 80, 95],
                borderColor: '#4f46e5',
                tension: 0.4,
                borderWidth: 3
            }, {
                label: 'Sign Language Views (hrs)',
                data: [80, 140, 110, 150, 130, 60, 70],
                borderColor: '#10b981',
                tension: 0.4,
                borderWidth: 3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- ACCESSIBILITY CORE (TTS & High Contrast & Live Regions) ---
function toggleLowVision() {
    const isChecked = document.getElementById('low-vision-toggle').checked;
    if(isChecked) {
        document.body.classList.add('low-vision-mode');
        announce("Low Vision Mode Activated");
    } else {
        document.body.classList.remove('low-vision-mode');
        announce("Low Vision Mode Deactivated");
    }
}

function toggleTTS() {
    ttsEnabled = document.getElementById('tts-toggle').checked;
    if(ttsEnabled) announce("Audio Reader enabled.");
    else synth.cancel();
}

function announce(message) {
    // 1. Write to aria-live region for true screen readers
    document.getElementById('aria-live-region').innerText = message;
    
    // 2. Play via internal TTS if enabled (for platform simulation)
    if (ttsEnabled && currentRole !== 'hearing') {
        synth.cancel(); // Stop current speech
        const u = new SpeechSynthesisUtterance(message);
        u.rate = 1.0;
        synth.speak(u);
    }
}

function speakNode(node) {
    if (!ttsEnabled) return;
    let text = node.getAttribute('aria-label') || node.innerText || node.value;
    if (text && text.trim().length > 0) {
        if(audioCtx.state === 'running') playActionBeep();
        announce(text.trim());
    }
}


// --- FEATURE IMPLEMENTATIONS: BLIND STUDENT ---

function startVoiceCommandSystem() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRec) { announce("Voice recognition not supported in this browser."); return; }
    
    speechRecognitionObj = new SpeechRec();
    speechRecognitionObj.continuous = true;
    speechRecognitionObj.interimResults = false;
    speechRecognitionObj.lang = 'en-US';
    
    speechRecognitionObj.onresult = (e) => {
        const cmd = e.results[e.results.length-1][0].transcript.toLowerCase().trim();
        console.log("Voice Command Received:", cmd);
        
        if (cmd.includes('quiz')) {
            openAudioQuiz();
        } else if (cmd.includes('object') || cmd.includes('identify')) {
            openObjectDescription();
        } else if (cmd.includes('a') && currentQuizActive) {
            handleQuizAnswer('A');
        } else if (cmd.includes('b') && currentQuizActive) {
            handleQuizAnswer('B');
        } else if (cmd.includes('dashboard') || cmd.includes('home')) {
            closeModal();
            buildDashboard();
        }
    };

    speechRecognitionObj.onerror = (e) => {
        console.error("Speech Recognition Error:", e.error);
        if (e.error !== 'not-allowed' && currentRole === 'blind') {
            setTimeout(() => {
                try { speechRecognitionObj.start(); } catch(err){}
            }, 1000);
        }
    };
    
    speechRecognitionObj.onend = () => {
        if (currentRole === 'blind') {
            try { speechRecognitionObj.start(); } catch(e){}
        }
    };
    
    try {
        speechRecognitionObj.start();
        document.getElementById('voice-listening-badge').classList.remove('hidden');
    } catch(e) {}
}

let currentQuestionIndex = 0;
const quizData = [
    { q: "What is the powerhouse of the cell?", a: "Nucleus", b: "Mitochondria", correct: "B", feedbackA: "Incorrect. Nucleus is the control center.", feedbackB: "Correct! Mitochondria is the powerhouse." },
    { q: "Which planet is known as the Red Planet?", a: "Mars", b: "Jupiter", correct: "A", feedbackA: "Correct! Mars has iron oxide surface.", feedbackB: "Incorrect. Jupiter is a gas giant." },
    { q: "What is H2O more commonly known as?", a: "Water", b: "Oxygen", correct: "A", feedbackA: "Correct! H2O is Water.", feedbackB: "Incorrect. Oxygen is O2." }
];

function openAudioQuiz() {
    currentQuizActive = true;
    currentQuestionIndex = 0;
    renderQuiz();
}

function renderQuiz() {
    const q = quizData[currentQuestionIndex];
    if(!q) {
        openModal("Quiz Completed", "<h2 class='text-4xl text-center font-bold text-emerald-600'>Quiz Finished!</h2>");
        announce("Quiz completed. Return to dashboard.");
        setTimeout(() => { if(currentRole==='blind') buildDashboard(); }, 3000);
        return;
    }
    
    const body = `
        <div class="h-full flex flex-col items-center justify-center p-10 text-center gap-8 w-full max-w-4xl mx-auto">
            <h3 class="text-3xl lg:text-4xl font-bold bg-white/50 dark:bg-slate-800/50 p-10 rounded-3xl w-full border border-white/30 shadow-lg text-slate-800 dark:text-white" tabindex="0" onfocus="speakNode(this)">
                Question ${currentQuestionIndex+1}: ${q.q}
            </h3>
            <div class="flex flex-col md:flex-row gap-8 w-full">
                <button id="ans-a" onclick="handleQuizAnswer('A')" onmouseover="speakNode(this)" onfocus="speakNode(this)" aria-label="Option A: ${q.a}" class="flex-1 p-10 text-3xl font-extrabold glass rounded-3xl border-4 border-transparent hover:border-indigo-500 focus-element shadow-2xl transition-all hover:scale-105 active:scale-95 text-slate-700 dark:text-slate-200">
                    A) ${q.a}
                </button>
                <button id="ans-b" onclick="handleQuizAnswer('B')" onmouseover="speakNode(this)" onfocus="speakNode(this)" aria-label="Option B: ${q.b}" class="flex-1 p-10 text-3xl font-extrabold glass rounded-3xl border-4 border-transparent hover:border-indigo-500 focus-element shadow-2xl transition-all hover:scale-105 active:scale-95 text-slate-700 dark:text-slate-200">
                    B) ${q.b}
                </button>
            </div>
            <p class="text-slate-500 dark:text-slate-400 font-bold mt-4 text-xl flex items-center justify-center gap-3">
                <i data-lucide="mic" class="w-8 h-8 animate-pulse text-red-500"></i> Speak "A" or "B" or use interactions.
            </p>
        </div>
    `;
    openModal("Interactive Audio Quiz", body);
    announce(`Question ${currentQuestionIndex+1}: ${q.q}. Option A: ${q.a}. Option B: ${q.b}.`);
}

function handleQuizAnswer(ans) {
    if(!currentQuizActive) return;
    const q = quizData[currentQuestionIndex];
    
    let btn = document.getElementById(`ans-${ans.toLowerCase()}`);
    if(!btn) return;

    if(ans === q.correct) {
        btn.classList.add('bg-emerald-200', 'dark:bg-emerald-900', 'border-emerald-500');
        btn.classList.remove('border-transparent');
        playSuccessBeep();
        triggerVibrationSim(); // Flash + Shake
        announce(q['feedback' + ans]);
    } else {
        btn.classList.add('bg-red-200', 'dark:bg-red-900', 'border-red-500');
        btn.classList.remove('border-transparent');
        playErrorBeep();
        triggerVibrationSim(); // Flash + Shake
        announce(q['feedback' + ans]);
    }
    
    currentQuizActive = false; // Disable voice answer temporarily
    
    // Move to next after a delay
    setTimeout(() => {
        currentQuestionIndex++;
        currentQuizActive = true;
        renderQuiz();
    }, 3500);
}

async function openObjectDescription() {
    const body = `
        <div class="flex flex-col items-center justify-center p-6 space-y-6 w-full max-w-4xl mx-auto">
            <div class="flex flex-col md:flex-row gap-6 w-full">
                <!-- Camera / Image Display Area -->
                <div class="w-full md:w-2/3 aspect-video bg-black rounded-3xl overflow-hidden relative shadow-2xl border-4 border-slate-800 flex-shrink-0">
                    <video id="camera-feed" class="w-full h-full object-cover" autoplay playsinline muted></video>
                    <img id="uploaded-image-preview" class="w-full h-full object-contain hidden bg-slate-900">
                    <canvas id="detection-canvas" class="absolute inset-0 w-full h-full z-10 pointer-events-none"></canvas>
                    <div class="absolute inset-0 flex items-center justify-center z-20" id="scan-overlay">
                        <div class="border-4 border-indigo-500 w-32 h-32 rounded-lg animate-ping absolute"></div>
                        <div class="bg-black/80 px-6 py-3 rounded-full text-white font-bold tracking-widest relative text-lg" id="scan-status-text">CAMERA INIT...</div>
                    </div>
                </div>
                
                <!-- Upload CTA -->
                <div class="flex flex-col w-full md:w-1/3 gap-4 justify-center">
                    <button onclick="document.getElementById('object-image-upload').click()" class="glass w-full h-full min-h-[150px] p-6 flex flex-col items-center justify-center gap-4 rounded-2xl hover:bg-white/40 transition-all focus-element border border-indigo-200" aria-label="Upload Static Image to Scan">
                        <i data-lucide="upload-cloud" class="w-16 h-16 text-indigo-500 animate-bounce"></i>
                        <span class="font-bold text-xl text-center text-slate-700 dark:text-slate-300">Upload Image<br><span class="text-sm font-normal">Instead of camera</span></span>
                    </button>
                    <input type="file" id="object-image-upload" accept="image/*" class="hidden" onchange="handleObjectImageUpload(event)">
                </div>
            </div>
            
            <div id="ai-result" class="glass w-full p-8 rounded-3xl text-3xl font-extrabold text-center text-indigo-800 dark:text-indigo-300 shadow-inner min-h-[120px] flex items-center justify-center focus-element" tabindex="0" onfocus="speakNode(this)">
                Waiting for objects...
            </div>
        </div>
    `;
    openModal("AI Object Scanner", body);
    announce("AI Object Scanner activated. Initializing camera and TensorFlow model. You can also upload a static image.");
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        cameraStream = stream;
        const video = document.getElementById('camera-feed');
        video.srcObject = stream;
        
        video.onloadeddata = async () => {
            const overlayText = document.getElementById('scan-status-text');
            if(overlayText) overlayText.innerText = 'LOADING MODEL...';
            
            if(!currentModel) {
                try {
                    currentModel = await cocoSsd.load();
                } catch(e) {
                    announce("Failed to load object detection model.");
                    return;
                }
            }
            
            const overlay = document.getElementById('scan-overlay');
            if(overlay) overlay.classList.add('hidden');
            announce("Scan active. Move your camera around.");
            
            const canvas = document.getElementById('detection-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            let lastAnnounced = "";
            let lastTime = 0;
            
            detectionInterval = setInterval(async () => {
                if(!video || video.paused || video.ended || !currentModel) return;
                
                const predictions = await currentModel.detect(video);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let labels = [];
                predictions.forEach(p => {
                    ctx.beginPath();
                    ctx.rect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]);
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = '#6366f1';
                    ctx.fillStyle = '#6366f1';
                    ctx.stroke();
                    ctx.font = '24px Arial';
                    ctx.fillText(p.class, p.bbox[0] + 5, p.bbox[1] > 25 ? p.bbox[1] - 5 : 25);
                    
                    if(p.score > 0.55) labels.push(p.class);
                });
                
                const res = document.getElementById('ai-result');
                if(!res) return;
                
                if(labels.length > 0) {
                    const uniqueLabels = [...new Set(labels)].join(" and ");
                    res.innerText = "I see: " + uniqueLabels;
                    
                    const now = Date.now();
                    if(uniqueLabels !== lastAnnounced && now - lastTime > 6000) {
                        playSuccessBeep();
                        announce("Detected " + uniqueLabels);
                        lastAnnounced = uniqueLabels;
                        lastTime = now;
                    }
                } else {
                    res.innerText = "Scanning...";
                }
            }, 600);
        };
    } catch(err) {
        const overlay = document.getElementById('scan-overlay');
        if(overlay) overlay.innerHTML = "<div class='text-red-500 p-4 bg-black font-bold'>Camera not active. Please use the image upload button.</div>";
        announce("Camera access was denied, but you can still upload images to scan.");
    }
}

async function handleObjectImageUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    if(detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    const video = document.getElementById('camera-feed');
    if(video) {
        video.pause();
        video.classList.add('hidden');
    }
    
    announce("Processing uploaded image for object detection.");
    playActionBeep();
    
    const imgElement = document.getElementById('uploaded-image-preview');
    imgElement.classList.remove('hidden');
    
    // Hide overlay
    const overlay = document.getElementById('scan-overlay');
    if(overlay) overlay.classList.add('hidden');
    
    const res = document.getElementById('ai-result');
    res.innerText = "Analyzing uploaded image...";
    
    const fileURL = URL.createObjectURL(file);
    imgElement.onload = async () => {
        if(!currentModel) {
            try { currentModel = await cocoSsd.load(); } catch(e) {}
        }
        if(!currentModel) {
            res.innerText = "Model failed to load.";
            announce("Model failed to load.");
            return;
        }
        
        const canvas = document.getElementById('detection-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.clientWidth;
        canvas.height = imgElement.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        try {
            const predictions = await currentModel.detect(imgElement);
            let labels = [];
            predictions.forEach(p => labels.push(p.class));
            
            if(labels.length > 0) {
                const uniqueLabels = [...new Set(labels)].join(" and ");
                res.innerText = "I see: " + uniqueLabels;
                playSuccessBeep();
                triggerVibrationSim();
                announce("Uploaded image contains: " + uniqueLabels);
            } else {
                res.innerText = "No identifiable objects found.";
                playErrorBeep();
                triggerVibrationSim();
                announce("No identifiable objects found in the uploaded image.");
            }
        } catch(e) {
            res.innerText = "Error analyzing image.";
            announce("Error analyzing image.");
        }
    };
    imgElement.src = fileURL;
}

function openAudioDocumentReader() {
    const body = `
        <div class="flex flex-col gap-6 h-full w-full max-w-4xl mx-auto items-center p-6">
            <h3 class="text-3xl font-bold mb-4 text-center">Paste Text or Upload PDF to Read Aloud</h3>
            <div class="flex flex-col md:flex-row gap-4 w-full h-64">
                <textarea id="doc-text-input" class="flex-1 p-6 glass rounded-2xl text-xl text-slate-800 dark:text-slate-200 focus-element border-2 border-transparent focus:border-indigo-500 shadow-inner resize-none" placeholder="Paste your document or text here..."></textarea>
                
                <div class="flex flex-col w-full md:w-1/3 gap-4">
                    <button onclick="document.getElementById('pdf-doc-upload').click()" class="glass h-full p-6 flex flex-col items-center justify-center gap-3 rounded-2xl hover:bg-white/40 transition-colors focus-element border border-pink-200" aria-label="Upload PDF to AI Simplify">
                        <i data-lucide="file-text" class="w-12 h-12 text-pink-500 animate-pulse"></i>
                        <span class="font-bold text-center text-slate-700 dark:text-slate-300">Upload PDF for AI Summary (Audio)</span>
                    </button>
                    <input type="file" id="pdf-doc-upload" accept=".pdf" class="hidden" onchange="handleAudioPdfUpload(event)">
                </div>
            </div>
            
            <div class="flex gap-6 w-full mt-4">
                <button onclick="readDocAloud()" class="flex-1 py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-2xl rounded-2xl shadow-xl hover:-translate-y-1 transition-all focus-element flex items-center justify-center gap-3">
                    <i data-lucide="play" class="w-8 h-8"></i> Read Aloud
                </button>
                <button onclick="synth.cancel()" class="flex-1 py-6 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-2xl rounded-2xl shadow-xl hover:-translate-y-1 transition-all focus-element flex items-center justify-center gap-3">
                    <i data-lucide="square" class="w-8 h-8"></i> Stop
                </button>
            </div>
        </div>
    `;
    openModal("Audio Document Reader", body);
    announce("Audio Document Reader opened. Focus the text area, paste your content, or upload a PDF to be simplified and read aloud.");
}

function handleAudioPdfUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    announce("Uploading PDF " + file.name + ". Extracting and simplifying content. Please wait.");
    playActionBeep();
    
    const txtArea = document.getElementById('doc-text-input');
    txtArea.value = "Extracting and analyzing PDF using AI...";
    txtArea.disabled = true;
    
    setTimeout(() => {
        txtArea.disabled = false;
        const mockSummary = "Here is the AI simplified summary of your PDF file: The primary topic is cellular biology. Key takeaways include: First, cells are the basic structure of all living things. Second, mitochondria generate power. Third, the nucleus holds genetic information.";
        txtArea.value = mockSummary;
        playSuccessBeep();
        triggerVibrationSim();
        announce("PDF simplified successfully. Reading aloud now.");
        
        setTimeout(() => readDocAloud(), 3000); // trigger auto read aloud after announcement finishes
    }, 4000);
}

function readDocAloud() {
    const txt = document.getElementById('doc-text-input').value;
    if(!txt.trim()) {
        announce("The text area is empty.");
        playErrorBeep();
        return;
    }
    playSuccessBeep();
    announce("Reading document: " + txt);
}


// --- FEATURE IMPLEMENTATIONS: HEARING IMPAIRED ---

function triggerVisualAlert() {
    const edge = document.getElementById('visual-notification-edge');
    edge.classList.add('flash-alert');
    setTimeout(() => {
        edge.classList.remove('flash-alert');
    }, 3000);
}

function openVideoLesson() {
    const body = `
        <div class="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden group border-4 border-slate-700 shadow-2xl">
            <div class="absolute inset-0 flex items-center justify-center">
                <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80" class="w-full h-full object-cover opacity-50" />
            </div>
            
            <!-- AI Sign Language Assistant -->
            <div class="absolute top-4 right-4 w-32 h-32 lg:w-48 lg:h-48 bg-slate-800 rounded-xl border-4 border-slate-600 shadow-2xl flex items-center justify-center overflow-hidden">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=SignAI" class="w-24 h-24 animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" alt="Sign Language Avatar Simulator">
                <div class="absolute bottom-0 w-full bg-black/80 text-white text-[10px] md:text-sm text-center py-1 font-bold">SIGN AI TRANSLATOR</div>
            </div>

            <!-- Speech-to-Text Captions -->
            <div class="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center">
                <p class="text-yellow-400 font-bold text-2xl md:text-3xl text-center bg-black/60 px-6 py-3 rounded-xl border border-white/20" id="live-caption">Welcome to Cellular Biology 101.</p>
            </div>
        </div>
        
        <div class="mt-6 flex flex-col md:flex-row gap-4 glass dark:bg-slate-800/80 p-4 rounded-2xl shadow-sm border border-white/20">
            <div class="flex-1 flex items-center gap-4">
                <button class="p-3 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-full transition-colors shadow-inner"><i data-lucide="play" class="w-6 h-6"></i></button>
                <div class="h-3 flex-1 max-w-[200px] bg-slate-200/50 dark:bg-slate-700/50 rounded-full border border-slate-300/50 overflow-hidden shadow-inner">
                    <div class="h-full bg-indigo-500 w-1/3 shadow-[0_0_10px_#6366f1]"></div>
                </div>
                <span class="text-slate-500 font-bold ml-2">10:04 / 35:00</span>
            </div>
            <div class="flex gap-3 justify-center">
                <button class="px-5 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95 border border-emerald-300 dark:border-emerald-700" onclick="simulateGestureNext()">
                    <i data-lucide="thumbs-up"></i> Gesture: Thumbs Up (Next)
                </button>
                <button class="px-5 py-3 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95 border border-amber-300 dark:border-amber-700" onclick="simulateGesturePause()">
                    <i data-lucide="hand"></i> Gesture: Raise Hand (Pause)
                </button>
            </div>
        </div>
    `;
    openModal("Video Lesson", body);
    document.getElementById('gesture-active-badge').classList.remove('hidden');
    
    let captions = ["Welcome to Cellular Biology 101.", "Today we will discuss the cell structure.", "Notice the cell membrane on the exterior.", "It acts as a protective barrier..."];
    let i = 0;
    const inter = setInterval(() => {
        if(!document.getElementById('live-caption')) { clearInterval(inter); return; }
        i = (i+1)%captions.length;
        document.getElementById('live-caption').innerText = captions[i];
    }, 4000);
}

function simulateGestureNext() {
    announce("Thumbs up gesture detected. Skipping to next chapter.");
    triggerVisualAlert();
}

function simulateGesturePause() {
    announce("Raise Hand gesture detected. Pausing video lesson.");
    triggerVisualAlert();
}

function updateSignDisplay(text) {
    const area = document.getElementById('sign-result-area');
    const word = text.toLowerCase().trim();
    document.getElementById('sign-result-text').innerText = word || '...';
    
    if(!word) {
        area.innerHTML = '<p class="text-slate-500 italic mt-8 font-medium">Type a word above to see real-time ASL spelling.</p>';
        return;
    }

    clearTimeout(signAnimationTimeout);
    
    const dictionary = {
        "hello": "https://api.dicebear.com/7.x/bottts/svg?seed=Hello&flip=true",
        "student": "https://api.dicebear.com/7.x/bottts/svg?seed=Student&size=120",
        "science": "https://api.dicebear.com/7.x/bottts/svg?seed=Science&backgroundColor=b6e3f4",
        "learn": "https://api.dicebear.com/7.x/bottts/svg?seed=Learn&radius=50",
        "teacher": "https://api.dicebear.com/7.x/bottts/svg?seed=Teacher",
        "thank you": "https://api.dicebear.com/7.x/bottts/svg?seed=Thanks"
    };

    if (dictionary[word]) {
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center mt-6 w-full">
                <img src="${dictionary[word]}" class="w-48 h-48 animate-bounce drop-shadow-2xl" alt="Sign for ${word}">
                <p class="mt-4 font-bold text-3xl text-indigo-700 dark:text-indigo-300 uppercase tracking-widest bg-white/50 dark:bg-slate-800 p-2 rounded shadow">${word}</p>
            </div>
        `;
        return;
    }
    
    let letters = word.replace(/[^a-z]/g, '').split('');
    if(letters.length === 0) return;
    
    area.innerHTML = `
        <div class="flex flex-col w-full h-full justify-center">
            <div id="active-sign-letter" class="flex flex-col items-center justify-center min-h-[160px] relative top-10">
                <img id="active-sign-img" src="https://api.dicebear.com/7.x/avataaars/svg?seed=${letters[0]}&backgroundColor=6366f1" class="w-32 h-32 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.5)] border-4 border-white transform transition-transform duration-300 scale-95" alt="Sign ${letters[0]}">
                <p class="mt-4 font-black text-5xl text-indigo-700 dark:text-indigo-300 uppercase block" id="active-sign-text">${letters[0]}</p>
            </div>
            <div class="w-full max-w-sm mx-auto bg-slate-200 dark:bg-slate-700 h-2 mt-20 mb-4 rounded-full overflow-hidden relative shadow-inner">
                <div id="sign-progress" class="h-full bg-indigo-500 w-0 transition-all duration-300"></div>
            </div>
        </div>
    `;

    let i = 0;
    function playNextLetter() {
        if(i >= letters.length) {
            area.innerHTML = `
                <div class="flex flex-wrap gap-4 items-center justify-center p-4 w-full h-full content-center mt-6 max-h-[250px] overflow-y-auto">
                    ${letters.map(l => `
                        <div class="flex flex-col items-center bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-white/20 shadow hover:-translate-y-1 transition-transform cursor-pointer">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${l}&backgroundColor=6366f1" class="w-16 h-16 rounded shadow border-2 border-white" alt="${l}">
                            <span class="font-black uppercase mt-1 text-lg">${l}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            return;
        }
        
        const img = document.getElementById('active-sign-img');
        const txt = document.getElementById('active-sign-text');
        const prog = document.getElementById('sign-progress');
        
        if (img && txt && prog) {
            img.style.transform = 'scale(0.8)';
            img.style.opacity = '0.5';
            
            setTimeout(() => {
                img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${letters[i]}&backgroundColor=6366f1`;
                txt.innerText = letters[i];
                prog.style.width = `${((i+1)/letters.length)*100}%`;
                
                img.style.transform = 'scale(1.1)';
                img.style.opacity = '1';
                setTimeout(() => { if(img) img.style.transform = 'scale(1)'; }, 150);
                
                i++;
                signAnimationTimeout = setTimeout(playNextLetter, 1200);
            }, 150);
        }
    }
    
    signAnimationTimeout = setTimeout(playNextLetter, 1200);
}

function openSignDictionary() {
    const body = `
        <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto py-2">
            <div class="relative">
                <i data-lucide="search" class="absolute left-4 top-4 text-indigo-400"></i>
                <input type="text" id="sign-search" placeholder="Type a word to translate to ASL sequence or animation..." class="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-indigo-100 focus:border-indigo-500 text-xl font-bold bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm dark:border-slate-700 focus-element shadow-inner transition-colors text-slate-800 dark:text-slate-100 uppercase" oninput="updateSignDisplay(this.value)">
            </div>
            
            <div class="glass p-8 rounded-3xl border border-white/20 min-h-[400px] flex flex-col items-center shadow-2xl relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                <div class="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
                
                <h4 class="font-bold text-slate-700 dark:text-slate-300 text-xl z-10 bg-white/50 dark:bg-black/20 px-4 py-2 rounded-lg backdrop-blur shadow-sm">
                    Showing sign sequence for: <span id="sign-result-text" class="text-indigo-600 dark:text-indigo-400 font-black tracking-widest uppercase">...</span>
                </h4>
                
                <div id="sign-result-area" class="w-full h-full relative z-10 flex flex-col items-center flex-1">
                    <p class="text-slate-500 italic mt-8 font-medium">Type a word above to see real-time ASL spelling.</p>
                </div>
            </div>
        </div>
    `;
    openModal("Sign Language Dictionary", body);
    announce("Sign language dictionary active.");
}

function openFileUpload() {
    const body = `
        <div class="flex flex-col gap-6">
            <div class="border-4 border-dashed border-indigo-200 dark:border-indigo-800 rounded-3xl p-10 flex flex-col items-center justify-center bg-indigo-50/50 dark:bg-slate-800/50 hover:bg-indigo-100/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group shadow-inner relative overflow-hidden" onclick="document.getElementById('file-upload-input').click()">
                <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <i data-lucide="upload-cloud" class="w-16 h-16 text-indigo-500 mb-4 animate-bounce drop-shadow-md"></i>
                <h3 class="text-3xl font-bold mb-2 text-center text-slate-800 dark:text-white relative z-10">Select or Drop File</h3>
                <p class="text-slate-500 text-center font-medium relative z-10">Supports Video (mp4), Images (jpg, png), and PDF</p>
                <input type="file" id="file-upload-input" class="hidden" accept="video/mp4,video/x-m4v,video/*,image/*,.pdf" onchange="handleFileUpload(event)">
            </div>
            
            <h4 class="font-bold text-xl text-slate-700 dark:text-slate-300 mb-[-10px]">Preview Window</h4>
            <div id="file-preview-area" class="w-full min-h-[350px] glass rounded-3xl p-6 flex flex-col items-center justify-center text-slate-500 border border-white/20 shadow-lg relative overflow-hidden">
                <i data-lucide="file-dashed" class="w-16 h-16 opacity-30 mb-2"></i>
                <p class="font-medium text-lg">No file uploaded yet</p>
            </div>
        </div>
    `;
    openModal("Upload Learning Materials", body);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    const previewArea = document.getElementById('file-preview-area');
    previewArea.innerHTML = '<div class="flex flex-col items-center gap-4"><i data-lucide="loader-2" class="w-12 h-12 animate-spin text-indigo-600 drop-shadow-md"></i><p class="text-lg font-bold text-indigo-600">Processing File...</p></div>';
    lucide.createIcons();
    announce("Processing uploaded file: " + file.name);
    
    // Simulate processing time
    setTimeout(() => {
        const fileURL = URL.createObjectURL(file);
        let previewHTML = '';
        
        if (file.type.startsWith('image/')) {
            previewHTML = `<img src="${fileURL}" class="max-w-full max-h-[300px] rounded-2xl shadow-xl border-4 border-white/50 object-cover hover:scale-105 transition-transform" alt="Uploaded Image">`;
        } else if (file.type.startsWith('video/')) {
            previewHTML = `<video src="${fileURL}" controls class="max-w-full max-h-[300px] rounded-2xl shadow-xl border-4 border-white/50 object-cover w-full bg-black"></video>`;
        } else if (file.type === 'application/pdf') {
            previewHTML = `<iframe src="${fileURL}#toolbar=0" class="w-full h-[320px] rounded-2xl shadow-xl border-4 border-white/50 bg-white"></iframe>`;
        } else {
            previewHTML = `
                <div class="flex flex-col items-center gap-2 p-8 bg-red-50 text-red-600 rounded-2xl border-2 border-red-200">
                    <i data-lucide="alert-triangle" class="w-12 h-12"></i>
                    <p class="font-bold text-lg">Unsupported file format</p>
                    <p class="text-sm">Please upload an image, video, or PDF.</p>
                </div>
            `;
        }
        
        previewArea.innerHTML = previewHTML;
        lucide.createIcons();
        announce("File preview generated successfully.");
    }, 1200);
}


// --- SHARED AI TOOLS ---

function openNoteSimplifier() {
    let body = "";
    
    if (currentRole === 'hearing') {
        body = `
            <div class="flex flex-col gap-6 w-full p-2 relative">
                <h3 class="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 tracking-tight text-center">Visual Note Simplifier</h3>
                <p class="text-slate-600 dark:text-slate-300 text-center mb-0 font-medium text-lg">Paste complex text below, and AI will generate visual diagrams, charts, and group graphics.</p>
                <div class="flex gap-4">
                    <textarea id="complex-text" class="flex-1 p-4 glass rounded-2xl text-lg min-h-[100px] resize-none border-2 border-transparent focus:border-indigo-400" placeholder="Paste your lesson text here..."></textarea>
                    
                    <div class="flex flex-col gap-2 w-48">
                        <button class="bg-indigo-600 text-white font-bold flex-1 px-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-colors" onclick="processVisualNotes()">Visualize Info</button>
                        <button class="bg-pink-600 text-white font-bold flex-1 px-4 rounded-xl shadow-lg hover:bg-pink-700 transition-colors flex items-center justify-center gap-2" onclick="document.getElementById('visual-pdf-upload').click()">
                            <i data-lucide="file-image" class="w-5 h-5"></i> Upload PDF
                        </button>
                        <input type="file" id="visual-pdf-upload" accept=".pdf,.png,.jpg" class="hidden" onchange="processVisualNotesMock()">
                    </div>
                </div>
                
                <div id="visual-notes-container" class="hidden flex flex-col gap-6 mt-2 border-t border-slate-200 dark:border-slate-700 pt-6 relative overflow-hidden">
                    <div id="visualizer-loader" class="absolute inset-0 glass z-50 flex flex-col items-center justify-center gap-4 hidden rounded-3xl backdrop-blur-md pb-10">
                        <div class="relative w-20 h-20">
                            <div class="absolute inset-0 border-8 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <i data-lucide="image" class="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-pulse"></i>
                        </div>
                        <p class="font-bold text-xl text-indigo-700 dark:text-white animate-pulse">Generating Images & Charts...</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="glass p-2 rounded-2xl shadow-lg flex flex-col relative overflow-hidden group border border-white/40 min-h-[160px]">
                            <h4 class="font-bold text-center text-slate-700 dark:text-slate-200 mb-2 uppercase tracking-wider z-10 bg-white/80 dark:bg-black/60 p-1.5 rounded-lg text-sm m-2 shadow">Group Study Concept Image</h4>
                            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" class="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-80 group-hover:scale-110 transition-transform duration-700">
                        </div>
                        <div class="glass p-2 rounded-2xl shadow-lg flex flex-col items-center bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border border-white/40 min-h-[160px]">
                            <h4 class="font-bold text-slate-700 dark:text-slate-200 mb-2 text-sm uppercase tracking-wider border-b-2 border-indigo-200 w-full text-center pb-1">AI Data Distribution</h4>
                            <div class="w-full flex-1 flex items-center justify-center p-2">
                                <canvas id="visual-pie-chart" class="max-h-[140px]"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        body = `
        <div class="flex flex-col lg:flex-row gap-6 h-[500px]">
            <div class="flex-1 flex flex-col gap-2">
                <label class="font-bold">Complex Academic Text</label>
                <textarea class="flex-1 resize-none bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus-element" readonly>The mitochondrion is a double-membrane-bound organelle found in most eukaryotic organisms. Mitochondria use aerobic respiration to generate most of the cell's supply of adenosine triphosphate (ATP), which is subsequently used throughout the cell as a source of chemical energy.</textarea>
                <button onclick="runNoteSimplifier()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl mt-2 flex justify-center items-center gap-2 focus-element">
                    <i data-lucide="sparkles"></i> Simplify Note
                </button>
            </div>
            <div class="flex-1 flex flex-col gap-2">
                <label class="font-bold">AI Simplified Output</label>
                <div id="simplified-output" class="flex-1 bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 relative">
                    <div id="ai-loader" class="absolute inset-0 flex items-center justify-center hidden">
                        <i data-lucide="loader-2" class="w-10 h-10 text-emerald-500 animate-spin"></i>
                    </div>
                    <ul id="ai-bullet-points" class="list-disc pl-6 space-y-4 font-medium text-lg text-slate-700 dark:text-slate-300 hidden" tabindex="0" focus-element>
                        <li>Mitochondria are tiny power plants inside cells.</li>
                        <li>They create a chemical called ATP.</li>
                        <li>ATP gives the cell energy to do its job.</li>
                    </ul>
                </div>
            </div>
        </div>
        `;
    }
    
    openModal(currentRole === 'hearing' ? "Visual Infographic Builder" : "AI Note Simplifier", body);
    if(currentRole === 'hearing') lucide.createIcons();
    announce("Note simplifier active.");
}

function processVisualNotesMock() {
    processVisualNotes();
}

function processVisualNotes() {
    const container = document.getElementById('visual-notes-container');
    const loader = document.getElementById('visualizer-loader');
    if(!container || !loader) return;
    
    container.classList.remove('hidden');
    loader.classList.remove('hidden');
    triggerVisualAlert(); // Re-using visual alert flash
    
    setTimeout(() => {
        loader.classList.add('hidden');
        renderVisualChart();
    }, 2500);
}

function renderVisualChart() {
    setTimeout(()=>{
        const canvas = document.getElementById('visual-pie-chart');
        if(!canvas) return;
        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Concept Mastery (45%)', 'Practical App (35%)', 'Theory (20%)'],
                datasets: [{
                    data: [45, 35, 20],
                    backgroundColor: ['#6366f1', '#ec4899', '#14b8a6'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: document.body.classList.contains('dark') ? '#cbd5e1' : '#334155', font: {size: 11, weight: 'bold'}, boxWidth: 10 } }
                },
                layout: { padding: 0 }
            }
        });
    }, 100);
}

function runNoteSimplifier() {
    let loader = document.getElementById('ai-loader');
    let output = document.getElementById('simplified-output');
    if (!loader) return;
    loader.classList.remove('hidden');
    
    const bullets = document.getElementById('ai-bullet-points');
    if(bullets) bullets.classList.add('hidden');
    
    setTimeout(() => {
        loader.classList.add('hidden');
        if(bullets) bullets.classList.remove('hidden');
        announce("Note simplified. Three bullet points generated.");
    }, 1500);
}

function openConceptVisualizer() {
    const body = `
        <div class="text-center p-6">
            <h3 class="text-xl font-bold mb-6">Text-to-Diagram: Cell Structure</h3>
            <div class="flex justify-center items-center gap-10">
                <!-- Data Visualization Simulation -->
                <div class="relative w-64 h-64 rounded-full border-8 border-indigo-200 flex items-center justify-center">
                    <div class="w-24 h-24 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-pulse">Nucleus</div>
                    
                    <div class="absolute top-4 left-4 w-12 h-16 bg-emerald-400 rounded-full flex items-center justify-center text-white text-[10px] shadow-lg transform rotate-45">Mito</div>
                    <div class="absolute bottom-4 right-10 w-16 h-12 bg-emerald-400 rounded-full flex items-center justify-center text-white text-[10px] shadow-lg transform -rotate-12">Mito</div>
                    
                    <div class="absolute inset-y-10 -right-8 w-8 h-24 bg-blue-400 rounded-full transform rotate-12 flex items-center justify-center text-white text-[10px]" style="writing-mode: vertical-rl;">Golgi</div>
                </div>
                <div class="text-left text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl max-w-xs focus-element" tabindex="0" onfocus="speakNode(this)" aria-label="AI Generated Diagram meaning. The large outer circle is the cell membrane. The center purple sphere is the Nucleus. The emerald ovals denote Mitochondria scattered in the cytoplasm.">
                    <p class="mb-2"><strong>AI Generated Diagram:</strong></p>
                    <ul class="list-disc pl-4 space-y-1">
                        <li>The large outer circle is the cell membrane.</li>
                        <li>The center purple sphere is the Nucleus.</li>
                        <li>The emerald ovals denote Mitochondria scattered in the cytoplasm.</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    openModal("AI Concept Visualizer", body);
    announce("AI Concept visualizer generated a diagram of cell structure replacing the text block.");
}


// --- MODAL SYSTEM ---

function openModal(title, bodyHTML) {
    document.getElementById('modal-heading').innerText = title;
    document.getElementById('modal-inner-content').innerHTML = bodyHTML;
    document.getElementById('unified-modal').classList.remove('hidden');
    document.getElementById('unified-modal').classList.add('flex');
    
    // Show back button
    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.classList.remove('hidden');
    
    // Auto-focus heading for screen readers
    const heading = document.getElementById('modal-heading');
    if(heading) heading.focus();
    
    lucide.createIcons();
}

function closeModal() {
    const modal = document.getElementById('unified-modal');
    if(!modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    
    currentQuizActive = false;
    document.getElementById('gesture-active-badge').classList.add('hidden');
    
    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.classList.add('hidden');
    
    synth.cancel(); // Stop reading immediately on close
    
    // Cleanup AI/Camera
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
}