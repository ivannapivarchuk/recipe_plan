// Recipe Plan – клієнтський рецептурний планувальник
// Усі дані зберігаються в localStorage та прив'язуються до користувача.

const STORAGE = {
    RECIPES: 'rp_recipes',
    USERS: 'rp_users',
    CURRENT_USER: 'rp_currentUser',
    FAVORITES: 'rp_favoritesByUser',
    DAILY_MENU: 'rp_dailyMenuByUser',
    WEEKLY_MENU: 'rp_weeklyMenuByUser',
    SHOPPING: 'rp_shoppingListByUser'
};

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const GUEST_USERNAME = 'guest';

document.addEventListener('DOMContentLoaded', () => {
    initAuthSystem();
    initNav();
    initTabs();
    initSampleDataIfNeeded();
    initWeeklyGrid();
    hookUIEvents();
    renderAll();
});

/* ===== Допоміжні функції localStorage ===== */

function safeParse(json, fallback) {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

/* ===== Користувачі й профілі ===== */

function getUsers() {
    const raw = localStorage.getItem(STORAGE.USERS);
    if (!raw) return [];
    return safeParse(raw, []);
}

function saveUsers(users) {
    localStorage.setItem(STORAGE.USERS, JSON.stringify(users));
}

function getCurrentUserId() {
    const id = localStorage.getItem(STORAGE.CURRENT_USER);
    if (id) return id;
    // якщо немає – повертаємо гість
    const guest = ensureGuestUser();
    localStorage.setItem(STORAGE.CURRENT_USER, guest.id);
    return guest.id;
}

function setCurrentUserId(id) {
    localStorage.setItem(STORAGE.CURRENT_USER, id);
}

function ensureGuestUser() {
    let users = getUsers();
    let guest = users.find(u => u.username === GUEST_USERNAME);
    if (!guest) {
        guest = {
            id: generateId('u_'),
            username: GUEST_USERNAME,
            email: '',
            password: ''
        };
        users.push(guest);
        saveUsers(users);
    }
    return guest;
}

function getCurrentUser() {
    const id = getCurrentUserId();
    const users = getUsers();
    return users.find(u => u.id === id) || ensureGuestUser();
}

/* ===== Рецепти ===== */

function getRecipes() {
    const raw = localStorage.getItem(STORAGE.RECIPES);
    if (!raw) return [];
    return safeParse(raw, []);
}

function saveRecipes(recipes) {
    localStorage.setItem(STORAGE.RECIPES, JSON.stringify(recipes));
}

/* ===== Улюблені (по користувачу) ===== */

function getFavoritesMap() {
    const raw = localStorage.getItem(STORAGE.FAVORITES);
    if (!raw) return {};
    return safeParse(raw, {});
}

function saveFavoritesMap(map) {
    localStorage.setItem(STORAGE.FAVORITES, JSON.stringify(map));
}

function getUserFavorites(userId) {
    const map = getFavoritesMap();
    return map[userId] || [];
}

function setUserFavorites(userId, arr) {
    const map = getFavoritesMap();
    map[userId] = arr;
    saveFavoritesMap(map);
}

/* ===== Меню та список покупок (по користувачу) ===== */

function getDailyMenuMap() {
    const raw = localStorage.getItem(STORAGE.DAILY_MENU);
    if (!raw) return {};
    return safeParse(raw, {});
}

function saveDailyMenuMap(map) {
    localStorage.setItem(STORAGE.DAILY_MENU, JSON.stringify(map));
}

function getWeeklyMenuMap() {
    const raw = localStorage.getItem(STORAGE.WEEKLY_MENU);
    if (!raw) return {};
    return safeParse(raw, {});
}

function saveWeeklyMenuMap(map) {
    localStorage.setItem(STORAGE.WEEKLY_MENU, JSON.stringify(map));
}

function getShoppingMap() {
    const raw = localStorage.getItem(STORAGE.SHOPPING);
    if (!raw) return {};
    return safeParse(raw, {});
}

function saveShoppingMap(map) {
    localStorage.setItem(STORAGE.SHOPPING, JSON.stringify(map));
}

function getDailyMenuForUser(userId) {
    const map = getDailyMenuMap();
    return Object.assign({ breakfastId: null, lunchId: null, dinnerId: null }, map[userId] || {});
}

function setDailyMenuForUser(userId, menu) {
    const map = getDailyMenuMap();
    map[userId] = menu;
    saveDailyMenuMap(map);
}

function getWeeklyMenuForUser(userId) {
    const base = {};
    DAYS_OF_WEEK.forEach(d => {
        base[d] = { breakfastId: null, lunchId: null, dinnerId: null };
    });
    const map = getWeeklyMenuMap();
    const userMenu = map[userId] || {};
    DAYS_OF_WEEK.forEach(d => {
        if (!userMenu[d]) userMenu[d] = { breakfastId: null, lunchId: null, dinnerId: null };
    });
    return Object.assign(base, userMenu);
}

function setWeeklyMenuForUser(userId, weeklyMenu) {
    const map = getWeeklyMenuMap();
    map[userId] = weeklyMenu;
    saveWeeklyMenuMap(map);
}

function getShoppingListForUser(userId) {
    const map = getShoppingMap();
    return map[userId] || [];
}

function setShoppingListForUser(userId, list) {
    const map = getShoppingMap();
    map[userId] = list;
    saveShoppingMap(map);
}

/* ===== Ініціалізація автентифікації ===== */

function initAuthSystem() {
    const guest = ensureGuestUser();
    if (!localStorage.getItem(STORAGE.CURRENT_USER)) {
        setCurrentUserId(guest.id);
    }
    updateCurrentUserLabel();

    const toggleBtn = document.getElementById('auth-toggle-btn');
    const panel = document.getElementById('auth-panel');
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('hidden');
        });
    }

    const tabButtons = document.querySelectorAll('.auth-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.authTab;
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.auth-tab').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('visible');
            });
            const target = document.getElementById('auth-' + tab);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('visible');
            }
        });
    });

    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
}

function updateCurrentUserLabel() {
    const label = document.getElementById('current-user-label');
    const user = getCurrentUser();
    if (label) {
        label.textContent = user.username === GUEST_USERNAME ? 'Гість' : user.username;
    }
}

function handleLogin() {
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    if (!identifier || !password) {
        alert('Вкажіть логін/email і пароль.');
        return;
    }

    const users = getUsers();
    const user = users.find(u =>
        (u.username === identifier || u.email === identifier) &&
        u.password === password
    );

    if (!user) {
        alert('Користувача не знайдено або пароль невірний.');
        return;
    }

    setCurrentUserId(user.id);
    updateCurrentUserLabel();
    document.getElementById('auth-panel').classList.add('hidden');
    renderAll();
}

function handleRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!username || !email || !password) {
        alert('Заповніть усі поля для реєстрації.');
        return;
    }

    let users = getUsers();
    if (users.some(u => u.username === username)) {
        alert('Такий логін вже використовується.');
        return;
    }
    if (users.some(u => u.email === email)) {
        alert('Такий email вже використовується.');
        return;
    }

    const newUser = {
        id: generateId('u_'),
        username,
        email,
        password // у реальному проєкті пароль має бути захешовано
    };
    users.push(newUser);
    saveUsers(users);

    setCurrentUserId(newUser.id);
    updateCurrentUserLabel();
    document.getElementById('auth-panel').classList.add('hidden');
    renderAll();
}

/* ===== Навігація й таби ===== */

function initNav() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            showSection(target);
            navLinks.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function showSection(id) {
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(sec => {
        if (sec.id === id) {
            sec.classList.add('visible');
        } else {
            sec.classList.remove('visible');
        }
    });
    if (id !== 'recipe-form-section') {
        // ховаємо форму авторизації, коли гуляємо сайтом
        const panel = document.getElementById('auth-panel');
        if (panel) panel.classList.add('hidden');
    }
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            const target = document.getElementById(tab);
            if (target) {
                target.classList.remove('hidden');
            }
        });
    });
}

/* ===== Початкові тестові дані ===== */

function initSampleDataIfNeeded() {
    const existing = getRecipes();
    if (existing && existing.length > 0) return;

    const sampleRecipes = [
        {
            id: generateId('r_'),
            title: 'Омлет із сиром',
            category: 'Сніданок',
            cookTime: 15,
            servings: 2,
            caloriesPerServing: 320,
            description: 'Швидкий і поживний сніданок із яйцями та твердим сиром.',
            ingredients: [
                '3 яйця',
                '40 мл молока',
                '20 г твердого сиру',
                'щіпка солі',
                'рослинна олія для смаження'
            ],
            steps: [
                'Збийте яйця з молоком та сіллю.',
                'Розігрійте сковороду з невеликою кількістю олії.',
                'Вилийте яєчну масу, посипте тертим сиром.',
                'Готуйте на середньому вогні до готовності, складіть омлет навпіл.'
            ]
        },
        {
            id: generateId('r_'),
            title: 'Крем-суп із гарбуза',
            category: 'Обід',
            cookTime: 40,
            servings: 3,
            caloriesPerServing: 250,
            description: 'Ніжний гарбузовий суп із вершками та часником.',
            ingredients: [
                '400 г гарбуза',
                '1 картоплина',
                '1 морква',
                '1 цибулина',
                '1–2 зубчики часнику',
                '200 мл вершків',
                'сіль, перець за смаком',
                'олія для обсмажування'
            ],
            steps: [
                'Наріжте овочі кубиками.',
                'Обсмажте цибулю й часник на олії до м’якоті.',
                'Додайте гарбуз, картоплю, моркву та залийте водою.',
                'Варіть до м’якості овочів, потім подрібніть блендером.',
                'Додайте вершки, доведіть майже до кипіння, приправте спеціями.'
            ]
        },
        {
            id: generateId('r_'),
            title: 'Запечене куряче філе з овочами',
            category: 'Вечеря',
            cookTime: 35,
            servings: 2,
            caloriesPerServing: 280,
            description: 'Легка вечеря: курка та овочі, запечені в духовці.',
            ingredients: [
                '300 г курячого філе',
                '1 болгарський перець',
                '1 невеликий кабачок',
                '1 цибулина',
                '2 ст. л. оливкової олії',
                'суміш трав, сіль, перець'
            ],
            steps: [
                'Наріжте філе та овочі середніми шматочками.',
                'Змішайте з олією, спеціями, сіллю та перцем.',
                'Викладіть у форму для запікання.',
                'Запікайте 25–30 хвилин при 190°C до золотистої скоринки.'
            ]
        },
        {
            id: generateId('r_'),
            title: 'Шоколадний брауні',
            category: 'Десерт',
            cookTime: 45,
            servings: 8,
            caloriesPerServing: 380,
            description: 'Соковитий шоколадний десерт із хрусткою скоринкою.',
            ingredients: [
                '200 г темного шоколаду',
                '150 г вершкового масла',
                '3 яйця',
                '180 г цукру',
                '120 г борошна',
                'дрібка солі'
            ],
            steps: [
                'Розтопіть шоколад із маслом на водяній бані.',
                'Збийте яйця з цукром до світлої маси.',
                'Влийте шоколадну суміш, додайте борошно та сіль, перемішайте.',
                'Вилийте тісто у форму та випікайте 20–25 хвилин при 180°C.'
            ]
        }
    ];

    saveRecipes(sampleRecipes);

    // Зробимо для гостя кілька улюблених рецептів
    const guest = ensureGuestUser();
    const favoritesMap = getFavoritesMap();
    favoritesMap[guest.id] = [sampleRecipes[0].id, sampleRecipes[3].id];
    saveFavoritesMap(favoritesMap);
}

/* ===== Події UI ===== */

function hookUIEvents() {
    // Форми рецепта
    const addBtn = document.getElementById('add-recipe-btn');
    const cancelRecipeBtn = document.getElementById('cancel-recipe-btn');
    const recipeForm = document.getElementById('recipe-form');

    if (addBtn) addBtn.addEventListener('click', () => openRecipeForm());
    if (cancelRecipeBtn) cancelRecipeBtn.addEventListener('click', () => showSection('recipes-section'));
    if (recipeForm) recipeForm.addEventListener('submit', handleRecipeFormSubmit);

    // Фільтри
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    if (searchInput) searchInput.addEventListener('input', renderRecipesList);
    if (categoryFilter) categoryFilter.addEventListener('change', renderRecipesList);

    // Меню
    const saveDailyBtn = document.getElementById('save-daily-menu-btn');
    const saveWeeklyBtn = document.getElementById('save-weekly-menu-btn');
    const shareDailyBtn = document.getElementById('share-daily-menu-btn');
    const shareWeeklyBtn = document.getElementById('share-weekly-menu-btn');

    if (saveDailyBtn) saveDailyBtn.addEventListener('click', handleSaveDailyMenu);
    if (saveWeeklyBtn) saveWeeklyBtn.addEventListener('click', handleSaveWeeklyMenu);
    if (shareDailyBtn) shareDailyBtn.addEventListener('click', shareDailyMenuAsText);
    if (shareWeeklyBtn) shareWeeklyBtn.addEventListener('click', shareWeeklyMenuAsText);

    // Список покупок
    const genShoppingBtn = document.getElementById('generate-shopping-list');
    const shareShoppingBtn = document.getElementById('share-shopping-list-btn');
    if (genShoppingBtn) genShoppingBtn.addEventListener('click', generateShoppingListFromMenus);
    if (shareShoppingBtn) shareShoppingBtn.addEventListener('click', shareShoppingListAsText);

    // Імпорт рецепта з файлу
    const importBtn = document.getElementById('import-recipe-file-btn');
    const importInput = document.getElementById('import-file-input');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', handleImportRecipeFile);
    }
}

/* ===== Рендер усього ===== */

function renderAll() {
    renderRecipesList();
    renderRecipeDetails(null);
    renderFavorites();
    populateMenuSelects();
    renderMenusToUI();
    renderShoppingListFromStorage();
}

/* ===== Список рецептів ===== */

function renderRecipesList() {
    const listEl = document.getElementById('recipes-list');
    if (!listEl) return;

    const recipes = getRecipes();
    const searchValue = (document.getElementById('search-input').value || '').toLowerCase().trim();
    const category = document.getElementById('category-filter').value;
    const currentUserId = getCurrentUserId();
    const userFavorites = getUserFavorites(currentUserId);

    const filtered = recipes.filter(r => {
        const matchesText = r.title.toLowerCase().includes(searchValue);
        const matchesCategory = category === 'all' || r.category === category;
        return matchesText && matchesCategory;
    });

    listEl.innerHTML = '';
    if (filtered.length === 0) {
        listEl.innerHTML = '<p class="muted">Рецептів за таким запитом не знайдено.</p>';
        return;
    }

    filtered.forEach(recipe => {
        const card = document.createElement('article');
        card.className = 'card recipe-card';

        const header = document.createElement('div');
        header.className = 'recipe-card-header';

        const titleEl = document.createElement('h2');
        titleEl.className = 'recipe-title';
        titleEl.textContent = recipe.title;

        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'recipe-category';
        categoryBadge.textContent = recipe.category;

        header.appendChild(titleEl);
        header.appendChild(categoryBadge);

        const meta = document.createElement('div');
        meta.className = 'recipe-meta';
        const metaParts = [];
        if (recipe.cookTime) metaParts.push(`${recipe.cookTime} хв`);
        if (recipe.servings) metaParts.push(`${recipe.servings} порцій`);
        if (recipe.caloriesPerServing) metaParts.push(`${recipe.caloriesPerServing} ккал/порція`);
        meta.innerHTML = metaParts.map(p => `<span>${p}</span>`).join('');

        const desc = document.createElement('p');
        desc.className = 'recipe-description';
        desc.textContent = recipe.description || 'Без опису.';

        const isFavorite = userFavorites.includes(recipe.id);
        const favBadge = document.createElement('span');
        favBadge.className = 'badge-favorite';
        favBadge.textContent = isFavorite ? '★ Улюблений' : '';

        const actions = document.createElement('div');
        actions.className = 'recipe-actions';

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'secondary-btn';
        viewBtn.textContent = 'Відкрити';
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renderRecipeDetails(recipe.id);
        });

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Редагувати';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openRecipeForm(recipe);
        });

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);

        card.appendChild(header);
        card.appendChild(meta);
        card.appendChild(desc);
        if (isFavorite) card.appendChild(favBadge);
        card.appendChild(actions);

        card.addEventListener('click', () => {
            renderRecipeDetails(recipe.id);
        });

        listEl.appendChild(card);
    });
}

/* ===== Деталі рецепта ===== */

function renderRecipeDetails(recipeId) {
    const detailsEl = document.getElementById('recipe-details');
    if (!detailsEl) return;

    if (!recipeId) {
        detailsEl.classList.add('hidden');
        detailsEl.innerHTML = '';
        return;
    }

    const recipes = getRecipes();
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
        detailsEl.classList.add('hidden');
        detailsEl.innerHTML = '';
        return;
    }

    detailsEl.classList.remove('hidden');

    const timeText = recipe.cookTime ? `${recipe.cookTime} хв` : 'невідомо';
    const servingsText = recipe.servings ? `${recipe.servings} порцій` : 'не вказано';
    const caloriesText = recipe.caloriesPerServing ? `${recipe.caloriesPerServing} ккал/порція` : 'не вказано';

    const currentUserId = getCurrentUserId();
    const userFavorites = getUserFavorites(currentUserId);
    const isFavorite = userFavorites.includes(recipe.id);

    detailsEl.innerHTML = `
        <div class="details-header">
            <h2>${recipe.title}</h2>
            <div class="details-meta">
                Категорія: <strong>${recipe.category}</strong> ·
                Час приготування: <strong>${timeText}</strong> ·
                Порцій: <strong>${servingsText}</strong> ·
                Калорійність: <strong>${caloriesText}</strong>
            </div>
        </div>
        <div class="details-grid">
            <div>
                <h3>Інгредієнти</h3>
                <ul>
                    ${(recipe.ingredients || []).map(ing => `<li>${ing}</li>`).join('')}
                </ul>
            </div>
            <div>
                <h3>Кроки приготування</h3>
                <ol>
                    ${(recipe.steps || []).map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
        </div>
        <p class="muted" style="margin-top: 0.75rem;">${recipe.description || ''}</p>
        <div class="recipe-actions">
            <button type="button" class="secondary-btn" id="toggle-favorite-btn">
                ${isFavorite ? 'Прибрати з улюблених' : 'Додати до улюблених'}
            </button>
            <button type="button" class="secondary-btn" id="add-to-menu-btn">
                Додати до меню (денного)
            </button>
            <button type="button" class="secondary-btn" id="export-txt-btn">
                Експорт у TXT
            </button>
            <button type="button" class="secondary-btn" id="print-pdf-btn">
                Друк / PDF
            </button>
        </div>
        <div class="recipe-actions" style="margin-top: 0.4rem;">
            <button type="button" class="secondary-btn" id="share-recipe-btn">
                Поділитися рецептом
            </button>
            <button type="button" class="secondary-btn" id="smart-kitchen-btn">
                Надіслати до «розумної кухні»
            </button>
            <button type="button" class="secondary-btn" id="delete-recipe-btn">
                Видалити рецепт
            </button>
        </div>
    `;

    document.getElementById('toggle-favorite-btn').addEventListener('click', () => {
        toggleFavorite(recipe.id);
    });

    document.getElementById('add-to-menu-btn').addEventListener('click', () => {
        addRecipeToDailyMenuPrompt(recipe.id);
    });

    document.getElementById('delete-recipe-btn').addEventListener('click', () => {
        if (confirm('Видалити цей рецепт?')) {
            deleteRecipe(recipe.id);
        }
    });

    document.getElementById('export-txt-btn').addEventListener('click', () => {
        exportRecipeToTxt(recipe);
    });

    document.getElementById('print-pdf-btn').addEventListener('click', () => {
        window.print();
    });

    document.getElementById('share-recipe-btn').addEventListener('click', () => {
        shareRecipeAsText(recipe);
    });

    document.getElementById('smart-kitchen-btn').addEventListener('click', () => {
        alert('Демонстраційна інтеграція: тут могла б бути відправка даних рецепта в API «розумної кухні».');
    });
}

/* ===== Форма рецепта ===== */

function openRecipeForm(recipe = null) {
    const formTitle = document.getElementById('recipe-form-title');
    const idField = document.getElementById('recipe-id');
    const titleField = document.getElementById('recipe-title');
    const categoryField = document.getElementById('recipe-category');
    const timeField = document.getElementById('recipe-time');
    const servingsField = document.getElementById('recipe-servings');
    const caloriesField = document.getElementById('recipe-calories');
    const descField = document.getElementById('recipe-description');
    const ingredientsField = document.getElementById('recipe-ingredients');
    const stepsField = document.getElementById('recipe-steps');

    if (recipe) {
        formTitle.textContent = 'Редагувати рецепт';
        idField.value = recipe.id;
        titleField.value = recipe.title;
        categoryField.value = recipe.category;
        timeField.value = recipe.cookTime || '';
        servingsField.value = recipe.servings || '';
        caloriesField.value = recipe.caloriesPerServing || '';
        descField.value = recipe.description || '';
        ingredientsField.value = (recipe.ingredients || []).join('\n');
        stepsField.value = (recipe.steps || []).join('\n');
    } else {
        formTitle.textContent = 'Новий рецепт';
        idField.value = '';
        titleField.value = '';
        categoryField.value = '';
        timeField.value = '';
        servingsField.value = '';
        caloriesField.value = '';
        descField.value = '';
        ingredientsField.value = '';
        stepsField.value = '';
    }

    showSection('recipe-form-section');
}

function handleRecipeFormSubmit(event) {
    event.preventDefault();
    const idField = document.getElementById('recipe-id');
    const titleField = document.getElementById('recipe-title');
    const categoryField = document.getElementById('recipe-category');
    const timeField = document.getElementById('recipe-time');
    const servingsField = document.getElementById('recipe-servings');
    const caloriesField = document.getElementById('recipe-calories');
    const descField = document.getElementById('recipe-description');
    const ingredientsField = document.getElementById('recipe-ingredients');
    const stepsField = document.getElementById('recipe-steps');

    const title = titleField.value.trim();
    const category = categoryField.value;
    if (!title || !category) {
        alert('Заповніть принаймні назву та категорію рецепта.');
        return;
    }

    const cookTime = timeField.value ? parseInt(timeField.value, 10) : null;
    const servings = servingsField.value ? parseInt(servingsField.value, 10) : null;
    const calories = caloriesField.value ? parseInt(caloriesField.value, 10) : null;
    const description = descField.value.trim();
    const ingredients = ingredientsField.value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    const steps = stepsField.value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

    let recipes = getRecipes();
    const existingId = idField.value;

    if (existingId) {
        const idx = recipes.findIndex(r => r.id === existingId);
        if (idx !== -1) {
            recipes[idx] = {
                ...recipes[idx],
                title,
                category,
                cookTime,
                servings,
                caloriesPerServing: calories,
                description,
                ingredients,
                steps
            };
        }
    } else {
        const newRecipe = {
            id: generateId('r_'),
            title,
            category,
            cookTime,
            servings,
            caloriesPerServing: calories,
            description,
            ingredients,
            steps
        };
        recipes.push(newRecipe);
    }

    saveRecipes(recipes);
    populateMenuSelects();
    renderRecipesList();
    renderFavorites();
    showSection('recipes-section');
}

/* ===== Операції з рецептами, фаворити ===== */

function deleteRecipe(id) {
    let recipes = getRecipes();
    recipes = recipes.filter(r => r.id !== id);
    saveRecipes(recipes);

    // Прибрати з фаворитів усіх користувачів
    const favMap = getFavoritesMap();
    Object.keys(favMap).forEach(uid => {
        favMap[uid] = favMap[uid].filter(rid => rid !== id);
    });
    saveFavoritesMap(favMap);

    // Прибрати з меню всіх користувачів
    const dailyMap = getDailyMenuMap();
    Object.keys(dailyMap).forEach(uid => {
        ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
            if (dailyMap[uid][meal] === id) dailyMap[uid][meal] = null;
        });
    });
    saveDailyMenuMap(dailyMap);

    const weeklyMap = getWeeklyMenuMap();
    Object.keys(weeklyMap).forEach(uid => {
        DAYS_OF_WEEK.forEach(day => {
            ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
                if (weeklyMap[uid][day] && weeklyMap[uid][day][meal] === id) {
                    weeklyMap[uid][day][meal] = null;
                }
            });
        });
    });
    saveWeeklyMenuMap(weeklyMap);

    renderRecipesList();
    renderRecipeDetails(null);
    renderFavorites();
    populateMenuSelects();
    renderMenusToUI();
}

function toggleFavorite(id) {
    const uid = getCurrentUserId();
    let favs = getUserFavorites(uid);
    if (favs.includes(id)) {
        favs = favs.filter(rid => rid !== id);
    } else {
        favs.push(id);
    }
    setUserFavorites(uid, favs);
    renderRecipesList();
    renderFavorites();
    renderRecipeDetails(id);
}

/* ===== Улюблені ===== */

function renderFavorites() {
    const favEl = document.getElementById('favorites-list');
    if (!favEl) return;

    const uid = getCurrentUserId();
    const recipes = getRecipes();
    const favIds = getUserFavorites(uid);
    const favorites = recipes.filter(r => favIds.includes(r.id));

    favEl.innerHTML = '';
    if (favorites.length === 0) {
        favEl.innerHTML = '<p class="muted">Поки немає улюблених рецептів.</p>';
        return;
    }

    favorites.forEach(recipe => {
        const card = document.createElement('article');
        card.className = 'card recipe-card';

        const header = document.createElement('div');
        header.className = 'recipe-card-header';

        const titleEl = document.createElement('h2');
        titleEl.className = 'recipe-title';
        titleEl.textContent = recipe.title;

        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'recipe-category';
        categoryBadge.textContent = recipe.category;

        header.appendChild(titleEl);
        header.appendChild(categoryBadge);

        const meta = document.createElement('div');
        meta.className = 'recipe-meta';
        const metaParts = [];
        if (recipe.cookTime) metaParts.push(`${recipe.cookTime} хв`);
        if (recipe.servings) metaParts.push(`${recipe.servings} порцій`);
        if (recipe.caloriesPerServing) metaParts.push(`${recipe.caloriesPerServing} ккал/порція`);
        meta.innerHTML = metaParts.map(p => `<span>${p}</span>`).join('');

        const desc = document.createElement('p');
        desc.className = 'recipe-description';
        desc.textContent = recipe.description || 'Без опису.';

        const actions = document.createElement('div');
        actions.className = 'recipe-actions';

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'secondary-btn';
        viewBtn.textContent = 'Відкрити';
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSection('recipes-section');
            renderRecipeDetails(recipe.id);
        });

        const favBtn = document.createElement('button');
        favBtn.type = 'button';
        favBtn.className = 'secondary-btn';
        favBtn.textContent = 'Прибрати з улюблених';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(recipe.id);
        });

        actions.appendChild(viewBtn);
        actions.appendChild(favBtn);

        card.appendChild(header);
        card.appendChild(meta);
        card.appendChild(desc);
        card.appendChild(actions);

        favEl.appendChild(card);
    });
}

/* ===== Меню (денне/тижневе) ===== */

function populateMenuSelects() {
    const recipes = getRecipes();
    const defaultOption = '<option value="">— не обрано —</option>';
    const optionsHtml = defaultOption + recipes.map(r => `<option value="${r.id}">${r.title}</option>`).join('');

    ['daily-breakfast', 'daily-lunch', 'daily-dinner'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            const currentValue = sel.value;
            sel.innerHTML = optionsHtml;
            sel.value = currentValue;
        }
    });

    // Для тижневого меню
    DAYS_OF_WEEK.forEach(day => {
        ['breakfast', 'lunch', 'dinner'].forEach(meal => {
            const selId = `weekly-${day}-` + meal;
            const sel = document.getElementById(selId);
            if (sel) {
                const currentValue = sel.value;
                sel.innerHTML = optionsHtml;
                sel.value = currentValue;
            }
        });
    });

    recalcCaloriesInfo();
}

function initWeeklyGrid() {
    const grid = document.getElementById('weekly-menu-grid');
    if (!grid) return;
    grid.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
        const card = document.createElement('div');
        card.className = 'weekday-card';

        const title = document.createElement('h3');
        title.textContent = day;

        const breakfastField = document.createElement('div');
        breakfastField.className = 'field';
        breakfastField.innerHTML = `
            <label for="weekly-${day}-breakfast">Сніданок</label>
            <select id="weekly-${day}-breakfast"></select>
        `;

        const lunchField = document.createElement('div');
        lunchField.className = 'field';
        lunchField.innerHTML = `
            <label for="weekly-${day}-lunch">Обід</label>
            <select id="weekly-${day}-lunch"></select>
        `;

        const dinnerField = document.createElement('div');
        dinnerField.className = 'field';
        dinnerField.innerHTML = `
            <label for="weekly-${day}-dinner">Вечеря</label>
            <select id="weekly-${day}-dinner"></select>
        `;

        card.appendChild(title);
        card.appendChild(breakfastField);
        card.appendChild(lunchField);
        card.appendChild(dinnerField);

        grid.appendChild(card);
    });

    populateMenuSelects();
}

function handleSaveDailyMenu() {
    const uid = getCurrentUserId();
    const breakfast = document.getElementById('daily-breakfast').value || null;
    const lunch = document.getElementById('daily-lunch').value || null;
    const dinner = document.getElementById('daily-dinner').value || null;

    const menu = {
        breakfastId: breakfast,
        lunchId: lunch,
        dinnerId: dinner
    };
    setDailyMenuForUser(uid, menu);
    alert('Денне меню збережено.');
    recalcCaloriesInfo();
}

function handleSaveWeeklyMenu() {
    const uid = getCurrentUserId();
    const weekly = getWeeklyMenuForUser(uid);

    DAYS_OF_WEEK.forEach(day => {
        weekly[day] = {
            breakfastId: document.getElementById(`weekly-${day}-breakfast`).value || null,
            lunchId: document.getElementById(`weekly-${day}-lunch`).value || null,
            dinnerId: document.getElementById(`weekly-${day}-dinner`).value || null
        };
    });

    setWeeklyMenuForUser(uid, weekly);
    alert('Тижневе меню збережено.');
    recalcCaloriesInfo();
}

function renderMenusToUI() {
    const uid = getCurrentUserId();
    const daily = getDailyMenuForUser(uid);
    const weekly = getWeeklyMenuForUser(uid);

    if (document.getElementById('daily-breakfast')) {
        document.getElementById('daily-breakfast').value = daily.breakfastId || '';
        document.getElementById('daily-lunch').value = daily.lunchId || '';
        document.getElementById('daily-dinner').value = daily.dinnerId || '';
    }

    DAYS_OF_WEEK.forEach(day => {
        const dayMenu = weekly[day] || {};
        const breakfast = document.getElementById(`weekly-${day}-breakfast`);
        const lunch = document.getElementById(`weekly-${day}-lunch`);
        const dinner = document.getElementById(`weekly-${day}-dinner`);
        if (breakfast) breakfast.value = dayMenu.breakfastId || '';
        if (lunch) lunch.value = dayMenu.lunchId || '';
        if (dinner) dinner.value = dayMenu.dinnerId || '';
    });

    recalcCaloriesInfo();
}

/* Додати рецепт до денного меню з деталей */

function addRecipeToDailyMenuPrompt(recipeId) {
    const meal = (prompt('Для якого прийому їжі додати рецепт? Введіть: сніданок / обід / вечеря') || '')
        .toLowerCase()
        .trim();
    const uid = getCurrentUserId();
    const daily = getDailyMenuForUser(uid);

    if (meal.startsWith('сні')) {
        daily.breakfastId = recipeId;
    } else if (meal.startsWith('об')) {
        daily.lunchId = recipeId;
    } else if (meal.startsWith('веч')) {
        daily.dinnerId = recipeId;
    } else {
        alert('Не вдалося розпізнати прийом їжі. Спробуйте ще раз.');
        return;
    }
    setDailyMenuForUser(uid, daily);
    renderMenusToUI();
}

/* ===== Калорії для меню ===== */

function recalcCaloriesInfo() {
    const uid = getCurrentUserId();
    const recipes = getRecipes();

    const daily = getDailyMenuForUser(uid);
    const dailyInfoEl = document.getElementById('daily-calories-info');
    if (dailyInfoEl) {
        let sumDaily = 0;
        ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
            const id = daily[meal];
            if (!id) return;
            const r = recipes.find(rcp => rcp.id === id);
            if (r && r.caloriesPerServing) {
                sumDaily += r.caloriesPerServing;
            }
        });
        if (sumDaily > 0) {
            dailyInfoEl.textContent = `Орієнтовна калорійність денного меню: ~${sumDaily} ккал.`;
        } else {
            dailyInfoEl.textContent = 'Калорійність денного меню буде показана після вибору страв з вказаними калоріями.';
        }
    }

    const weekly = getWeeklyMenuForUser(uid);
    const weeklyInfoEl = document.getElementById('weekly-calories-info');
    if (weeklyInfoEl) {
        let sumWeekly = 0;
        DAYS_OF_WEEK.forEach(day => {
            const dm = weekly[day];
            ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
                const id = dm[meal];
                if (!id) return;
                const r = recipes.find(rcp => rcp.id === id);
                if (r && r.caloriesPerServing) {
                    sumWeekly += r.caloriesPerServing;
                }
            });
        });
        if (sumWeekly > 0) {
            weeklyInfoEl.textContent = `Орієнтовна калорійність тижневого меню: ~${sumWeekly} ккал.`;
        } else {
            weeklyInfoEl.textContent = 'Калорійність тижневого меню буде показана після вибору страв з вказаними калоріями.';
        }
    }
}

/* ===== Список покупок ===== */

function generateShoppingListFromMenus() {
    const uid = getCurrentUserId();
    const recipes = getRecipes();
    const daily = getDailyMenuForUser(uid);
    const weekly = getWeeklyMenuForUser(uid);

    const recipeIds = new Set();

    // З денного меню
    ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
        if (daily[meal]) recipeIds.add(daily[meal]);
    });

    // З тижневого меню
    DAYS_OF_WEEK.forEach(day => {
        ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
            if (weekly[day][meal]) recipeIds.add(weekly[day][meal]);
        });
    });

    if (recipeIds.size === 0) {
        alert('Немає обраних рецептів у меню. Спочатку збережіть денне або тижневе меню.');
        return;
    }

    // Збираємо інгредієнти
    const ingredientsMap = {}; // ключ = текст інгредієнта, значення = кількість повторів
    recipeIds.forEach(id => {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        (recipe.ingredients || []).forEach(ing => {
            const key = ing.trim();
            if (!key) return;
            if (!ingredientsMap[key]) ingredientsMap[key] = 0;
            ingredientsMap[key] += 1;
        });
    });

    const list = Object.entries(ingredientsMap).map(([text, count]) => ({
        text: count > 1 ? `${text}  ×${count}` : text,
        checked: false
    }));

    setShoppingListForUser(uid, list);
    renderShoppingList(list);
}

function renderShoppingListFromStorage() {
    const uid = getCurrentUserId();
    const list = getShoppingListForUser(uid);
    if (!list || list.length === 0) {
        const listEl = document.getElementById('shopping-list');
        const msgEl = document.getElementById('shopping-empty-msg');
        if (listEl) listEl.innerHTML = '';
        if (msgEl) msgEl.style.display = 'block';
        return;
    }
    renderShoppingList(list);
}

function renderShoppingList(list) {
    const listEl = document.getElementById('shopping-list');
    const msgEl = document.getElementById('shopping-empty-msg');
    if (!listEl || !msgEl) return;

    listEl.innerHTML = '';
    if (!list || list.length === 0) {
        msgEl.style.display = 'block';
        return;
    }
    msgEl.style.display = 'none';

    list.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'shopping-item' + (item.checked ? ' checked' : '');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.checked;
        checkbox.addEventListener('change', () => {
            item.checked = checkbox.checked;
            li.classList.toggle('checked', checkbox.checked);
            const uid = getCurrentUserId();
            const currentList = getShoppingListForUser(uid);
            currentList[index] = item;
            setShoppingListForUser(uid, currentList);
        });

        const textSpan = document.createElement('span');
        textSpan.textContent = item.text;

        li.appendChild(checkbox);
        li.appendChild(textSpan);
        listEl.appendChild(li);
    });
}

/* ===== Експорт / шеринг ===== */

function recipeToPlainText(recipe) {
    const lines = [];
    lines.push(recipe.title);
    lines.push(`Категорія: ${recipe.category}`);
    if (recipe.cookTime) lines.push(`Час: ${recipe.cookTime} хв`);
    if (recipe.servings) lines.push(`Порцій: ${recipe.servings}`);
    if (recipe.caloriesPerServing) lines.push(`Калорійність: ${recipe.caloriesPerServing} ккал/порція`);
    if (recipe.description) {
        lines.push('');
        lines.push(recipe.description);
    }
    lines.push('');
    lines.push('Інгредієнти:');
    (recipe.ingredients || []).forEach(ing => lines.push('- ' + ing));
    lines.push('');
    lines.push('Кроки приготування:');
    (recipe.steps || []).forEach((step, i) => lines.push((i + 1) + '. ' + step));
    return lines.join('\n');
}

function exportRecipeToTxt(recipe) {
    const text = recipeToPlainText(recipe);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const safeTitle = recipe.title.replace(/[^a-zа-я0-9]+/gi, '_').toLowerCase();
    a.download = `recipe_${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function shareRecipeAsText(recipe) {
    const text = recipeToPlainText(recipe);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => alert('Текст рецепта скопійовано в буфер обміну.'))
            .catch(() => alert('Не вдалося скопіювати текст автоматично.'));
    } else {
        alert('Ваш браузер не підтримує Clipboard API. Скопіюйте текст вручну:\n\n' + text);
    }
}

function shareDailyMenuAsText() {
    const uid = getCurrentUserId();
    const recipes = getRecipes();
    const daily = getDailyMenuForUser(uid);

    const lines = [];
    lines.push('Денне меню:');
    ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
        const id = daily[meal];
        const label = meal === 'breakfastId' ? 'Сніданок' : meal === 'lunchId' ? 'Обід' : 'Вечеря';
        if (!id) {
            lines.push(`${label}: не обрано`);
        } else {
            const r = recipes.find(rcp => rcp.id === id);
            lines.push(`${label}: ${r ? r.title : '—'}`);
        }
    });

    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => alert('Денне меню скопійовано в буфер обміну.'))
            .catch(() => alert('Не вдалося скопіювати текст автоматично.'));
    } else {
        alert('Ваш браузер не підтримує Clipboard API. Скопіюйте текст вручну:\n\n' + text);
    }
}

function shareWeeklyMenuAsText() {
    const uid = getCurrentUserId();
    const recipes = getRecipes();
    const weekly = getWeeklyMenuForUser(uid);

    const lines = [];
    lines.push('Тижневе меню:');
    DAYS_OF_WEEK.forEach(day => {
        lines.push('');
        lines.push(day + ':');
        const dm = weekly[day];
        ['breakfastId', 'lunchId', 'dinnerId'].forEach(meal => {
            const id = dm[meal];
            const label = meal === 'breakfastId' ? '  Сніданок' : meal === 'lunchId' ? '  Обід' : '  Вечеря';
            if (!id) {
                lines.push(`${label}: не обрано`);
            } else {
                const r = recipes.find(rcp => rcp.id === id);
                lines.push(`${label}: ${r ? r.title : '—'}`);
            }
        });
    });

    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => alert('Тижневе меню скопійовано в буфер обміну.'))
            .catch(() => alert('Не вдалося скопіювати текст автоматично.'));
    } else {
        alert('Ваш браузер не підтримує Clipboard API. Скопіюйте текст вручну:\n\n' + text);
    }
}

function shareShoppingListAsText() {
    const uid = getCurrentUserId();
    const list = getShoppingListForUser(uid);
    if (!list || list.length === 0) {
        alert('Список покупок порожній.');
        return;
    }
    const lines = [];
    lines.push('Список покупок:');
    list.forEach(item => {
        lines.push('- ' + item.text);
    });
    const text = lines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => alert('Список покупок скопійовано в буфер обміну.'))
            .catch(() => alert('Не вдалося скопіювати текст автоматично.'));
    } else {
        alert('Ваш браузер не підтримує Clipboard API. Скопіюйте текст вручну:\n\n' + text);
    }
}

/* ===== Імпорт рецепта з TXT ===== */

function handleImportRecipeFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const text = reader.result;
        try {
            const recipe = parseRecipeFromTxt(text);
            if (!recipe.title || !recipe.category) {
                alert('Не вдалося розпізнати назву або категорію рецепта. Перевірте формат файлу.');
                return;
            }
            const recipes = getRecipes();
            recipe.id = generateId('r_');
            recipes.push(recipe);
            saveRecipes(recipes);
            populateMenuSelects();
            renderRecipesList();
            alert('Рецепт імпортовано з файлу.');
        } catch (e) {
            console.error(e);
            alert('Сталася помилка під час імпорту рецепта. Перевірте формат файлу.');
        }
    };
    reader.readAsText(file, 'utf-8');

    // очищаємо вибір файлу
    event.target.value = '';
}

function parseRecipeFromTxt(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    while (lines.length && !lines[0]) lines.shift();

    const title = lines.shift() || '';
    const category = lines.shift() || '';
    const description = (lines.shift() || '');

    // пропускаємо порожній рядок після опису, якщо є
    while (lines.length && !lines[0]) lines.shift();

    const ingredients = [];
    const steps = [];
    let mode = 'ingredients';

    lines.forEach(line => {
        if (!line) {
            if (mode === 'ingredients' && ingredients.length > 0) {
                mode = 'steps';
            }
            return;
        }
        if (mode === 'ingredients') {
            ingredients.push(line.replace(/^[-•]\s*/, ''));
        } else {
            steps.push(line.replace(/^\d+\.\s*/, ''));
        }
    });

    return {
        title,
        category,
        description,
        ingredients,
        steps,
        cookTime: null,
        servings: null,
        caloriesPerServing: null
    };
}

/* ===== Службові ===== */

function generateId(prefix = '') {
    return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
