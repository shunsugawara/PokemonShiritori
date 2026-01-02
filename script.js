document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const historyList = document.getElementById('history-list');
    const candidateList = document.getElementById('candidate-list');
    const historyCount = document.getElementById('history-count');
    const prevPokemonName = document.getElementById('prev-pokemon-name');
    const targetCharSpan = document.getElementById('target-char');
    const gameOverModal = document.getElementById('game-over-modal');
    const finalScore = document.getElementById('final-score');
    const restartBtn = document.getElementById('restart-btn');
    const gameOverReason = document.getElementById('game-over-reason');

    // State
    let allPokemon = []; // {id: 1, name: "bulbasaur"}
    let history = [];
    let currentLastChar = null; // Next expected char. Null means "ANY"

    // Load Data
    async function loadData() {
        try {
            const response = await fetch('list/list.csv');
            const data = await response.text();
            parseCSV(data);
            initGame();
        } catch (error) {
            console.error("Failed to load pokemon list:", error);
            alert("データの読み込みに失敗しました");
        }
    }

    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        allPokemon = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const [id, name] = trimmed.split(',');
            if (id && name) {
                allPokemon.push({
                    id: parseInt(id),
                    name: name
                });
            }
        }
        // Ensure ID sort (List seems sorted already but just in case)
        allPokemon.sort((a, b) => a.id - b.id);
    }

    function initGame() {
        history = [];
        currentLastChar = null;
        updateUI();
        gameOverModal.classList.add('hidden');
    }

    // Helper: Normalize Char (Handles small kana)
    function normalizeChar(char) {
        const smallMap = {
            'ァ': 'ア', 'ィ': 'イ', 'ゥ': 'ウ', 'ェ': 'エ', 'ォ': 'オ',
            'ッ': 'ツ', 'ャ': 'ヤ', 'ュ': 'ユ', 'ョ': 'ヨ', 'ヮ': 'ワ'
        };
        return smallMap[char] || char;
    }

    // Helper: Get effective last char of a name
    // e.g. "フリーザー" -> "ザ"
    function getEffectiveLastChar(name) {
        // Strip trailing spaces just in case
        name = name.trim();
        let last = name.slice(-1);

        if (last === 'ー') {
            last = name.slice(-2, -1);
        }

        return last;
    }

    function handleSelection(pokemon) {
        // 1. Check for duplicate (Simpler rule: can't use SAME species again? 
        // Shiritori usually doesn't allow reuse. Let's block reuse.)
        if (history.some(p => p.id === pokemon.id)) {
            // Should be filtered out in candidate view, but safety check
            return;
        }

        // 2. Add to history
        history.push(pokemon);

        // 3. Determine next char
        let rawLast = getEffectiveLastChar(pokemon.name);

        // Check Game Over
        if (rawLast === 'ン') {
            endGame("「ン」がついた！");
            updateUI(); // Render the last move
            return;
        }

        currentLastChar = normalizeChar(rawLast);

        updateUI();
        scrollToBottom();
    }

    function endGame(reason) {
        finalScore.textContent = history.length;
        gameOverReason.textContent = reason;
        gameOverModal.classList.remove('hidden');
    }

    function updateUI() {
        // Render History
        renderHistory();

        // Render Candidates
        renderCandidates();

        // Update Info Header
        historyCount.textContent = `${history.length}匹`;

        if (history.length > 0) {
            const lastPoke = history[history.length - 1];
            prevPokemonName.textContent = lastPoke.name;
            targetCharSpan.textContent = `「${currentLastChar}」`;
        } else {
            prevPokemonName.textContent = "-";
            targetCharSpan.textContent = "全";
        }
    }

    function renderHistory() {
        // Optimization: Append only new items if we want, but re-render is safer for state sync
        // For performance, simple re-render is fine for < 1000 items as DOM ops
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-state">ポケモンを選んでスタート！</div>';
            return;
        }

        history.forEach((poke, index) => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${poke.id}.png" alt="${poke.name}" loading="lazy">
                <div class="history-info">
                    <span class="index">${index + 1}.</span>
                    <span class="name">${poke.name}</span>
                </div>
            `;
            historyList.appendChild(el);
        });
    }

    function scrollToBottom() {
        setTimeout(() => {
            historyList.scrollTop = historyList.scrollHeight;
        }, 50);
    }

    function renderCandidates() {
        candidateList.innerHTML = '';

        // Filter filtered candidates
        let candidates = allPokemon.filter(poke => {
            // Rule 1: Not already used
            if (history.some(h => h.id === poke.id)) return false;

            // Rule 2: Matches currentLastChar (if exists)
            if (currentLastChar) {
                if (!poke.name.startsWith(currentLastChar)) return false;
            }

            return true;
        });

        // Optimization: If too many, maybe limit? But prompt says "Grid format". 
        // 1000 items might be heavy. Let's use lazy loading images effectively.
        // We will render all DOM nodes but rely on browser layout speed.

        if (candidates.length === 0) {
            candidateList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">候補がいません...</div>';
            if (history.length > 0) {
                // If it's not the start and no candidates, does that mean softlock/win?
                // Usually in solo shiritori, you just stop. Let's leave it as is.
            }
            return;
        }

        // Create document fragment for performance
        const fragment = document.createDocumentFragment();

        candidates.forEach(poke => {
            const card = document.createElement('div');
            card.className = 'pokemon-card';
            card.onclick = () => handleSelection(poke);

            const img = document.createElement('img');
            img.dataset.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${poke.id}.png`;
            img.alt = poke.name;
            img.loading = "lazy";

            // Basic intersection observer for fade-in effect or just native lazy load
            // The constraint asked for "Lazy Loading". Native `loading="lazy"` covers network.
            // For the fade-in effect to verify it loaded:
            img.onload = () => img.classList.add('loaded');
            img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${poke.id}.png`; // setting src triggers load

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = poke.name;

            card.appendChild(img);
            card.appendChild(name);
            fragment.appendChild(card);
        });

        candidateList.appendChild(fragment);
    }

    // Modal Interaction
    restartBtn.addEventListener('click', () => {
        initGame();
    });

    // Start
    loadData();
});
