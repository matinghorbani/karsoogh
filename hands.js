let video = document.getElementById('input_video');
let canvas = document.getElementById('output_canvas');
let ctx = canvas.getContext('2d');
const fpsControl = new FPS();
const controlsElement3 = document.getElementsByClassName('control3')[0];

let fingerCountElement = document.getElementById('finger-count');
let progressBarElement = document.getElementById('progress-bar');
let resultOverlay = document.getElementById('result-overlay');
let resultMessage = document.getElementById('result-message');
let nextButton = document.getElementById('next-button');
let resultsTable = document.getElementById('results-table');
let resultsSummary = document.getElementById('results-summary');
let resultsTbody = document.getElementById('results-tbody');

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.1/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.5
});

let questions = [
    {
        question: "What is the height in an HD Image?",
        choices: ["480", "720", "1080", "240"],
        answer: 1
    },
    {
        question: "How many corners does a hexagon have?",
        choices: ["Three", "Four", "Five", "Six"],
        answer: 3
    },
    {
        question: "What is the variable type of a? a = 'yes'",
        choices: ["Integer", "Float", "String", "Character"],
        answer: 2
    },
    {
        question: "How many oceans are in the world?",
        choices: ["Two", "Three", "Four", "Five"],
        answer: 3
    }
];

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

questions = questions.map(question => {
    let choices = question.choices.slice(); // Copy the choices array
    let correctAnswer = choices[question.answer]; // Get the correct answer
    choices = shuffleArray(choices); // Shuffle the choices
    let newAnswer = choices.indexOf(correctAnswer); // Find the new index of the correct answer
    return {
        question: question.question,
        choices: choices,
        answer: newAnswer
    };
});

let currentQuestionIndex = 0;
let selectionStartTime = null;
const selectionThreshold = 3000; // 3 seconds
let questionsResults = [];

function drawQuestion(question) {
    let container = document.getElementById('question-container');
    container.innerHTML = `<p class="title">${question.question}</p>`;
    question.choices.forEach((choice, index) => {
        container.innerHTML += `<p class="subtitle choice" id="choice-${index}">${choice}</p>`;
    });
}

function countExtendedFingers(landmarks) {
    const tips = [8, 12, 16, 20];
    let count = 0;
    for (let tip of tips) {
        let mcp = tip - 2;
        if (landmarks[tip].y < landmarks[mcp].y) { // for simplicity assuming y decreases upwards
            count++;
        }
    }
    return count;
}

function updateProgressBar() {
    let progress = (currentQuestionIndex / questions.length) * 100;
    progressBarElement.style.width = `${progress}%`;
}

function showResult(isCorrect, correctAnswer) {
    resultOverlay.style.display = 'block';
    if (isCorrect) {
        resultOverlay.classList.add('correct');
        resultOverlay.classList.remove('incorrect');
        resultMessage.textContent = `Correct!`;
    } else {
        resultOverlay.classList.add('incorrect');
        resultOverlay.classList.remove('correct');
        resultMessage.textContent = `Incorrect! The correct answer was: ${correctAnswer}`;
    }
}

function hideResult() {
    resultOverlay.style.display = 'none';
}

function showFinalResults() {
    let correctAnswers = questionsResults.filter(result => result.isCorrect).length;
    let totalQuestions = questions.length;
    resultsSummary.textContent = `You answered ${correctAnswers} out of ${totalQuestions} questions correctly.`;

    questionsResults.forEach((result, index) => {
        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${questions[index].question}</td>
            <td>${questions[index].choices[result.answer]}</td>
            <td>${questions[index].choices[questions[index].answer]}</td>
            <td>${result.isCorrect ? 'Correct' : 'Incorrect'}</td>
        `;
        resultsTbody.appendChild(row);
    });

    resultsTable.style.display = 'block';
}

nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        drawQuestion(questions[currentQuestionIndex]);
        updateProgressBar();
        hideResult();
    } else {
        document.getElementById('question-container').innerHTML = '<p class="title">Quiz Completed</p>';
        updateProgressBar();
        hideResult();
        showFinalResults();
        console.log(questionsResults);
    }
});

function onResults(results) {
    document.body.classList.add('loaded');
    fpsControl.tick();

    ctx.save();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    if (results.multiHandLandmarks) {
        for (let landmarks of results.multiHandLandmarks) {
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
            drawLandmarks(ctx, landmarks, {
                color: '#FF0000',
                lineWidth: 2,
                radius: (x) => lerp(x.from.z, -0.15, .1, 10, 1)
            });

            let fingerCount = countExtendedFingers(landmarks);
            fingerCountElement.textContent = fingerCount;
            let now = Date.now();

            if (fingerCount > 0 && fingerCount <= 4) {
                if (!selectionStartTime) {
                    selectionStartTime = now;
                } else if (now - selectionStartTime > selectionThreshold) {
                    let isCorrect = (fingerCount - 1 === questions[currentQuestionIndex].answer);
                    let correctAnswer = questions[currentQuestionIndex].choices[questions[currentQuestionIndex].answer];
                    questionsResults.push({
                        answer: fingerCount - 1,
                        isCorrect: isCorrect
                    });
                    showResult(isCorrect, correctAnswer);

                    selectionStartTime = null;
                }
            } else {
                selectionStartTime = null;
            }
        }
        ctx.restore();
    }
}

hands.onResults(onResults);

const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({image: video});
    },
    width: 640,
    height: 480
});
camera.start();

new ControlPanel(controlsElement3, {
    selfieMode: true,
    maxNumHands: 1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.5
})
    .add([
        new StaticText({title: 'MediaPipe Hands'}),
        fpsControl,
        new Toggle({title: 'Selfie Mode', field: 'selfieMode'}),
        new Slider(
            {title: 'Max Number of Hands', field: 'maxNumHands', range: [1, 4], step: 1}),
        new Slider({
            title: 'Min Detection Confidence',
            field: 'minDetectionConfidence',
            range: [0, 1],
            step: 0.01
        }),
        new Slider({
            title: 'Min Tracking Confidence',
            field: 'minTrackingConfidence',
            range: [0, 1],
            step: 0.01
        }),
    ])
    .on(options => {
        video.classList.toggle('selfie', options.selfieMode);
        hands.setOptions(options);
    });

window.onload = function () {
    drawQuestion(questions[currentQuestionIndex]);
}
