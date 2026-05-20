import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, FolderOpen, Trash2, Info, Sun, Moon } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useGameStore } from "../store/useGameStore";
import { setLanguage } from "../hooks/useTranslation";

interface AppSettings {
  install_dir: string;
  bunnycdn_base_url: string;
  bunnycdn_storage_zone: string;
  bunnycdn_api_key: string;
  theme: string;
  launch_on_startup: boolean;
  language: string;
  goldberg_path?: string;
  rawg_api_key?: string;
}

const defaults: AppSettings = {
  install_dir: "",
  bunnycdn_base_url: "",
  bunnycdn_storage_zone: "",
  bunnycdn_api_key: "",
  theme: "dark",
  launch_on_startup: false,
  language: "en",
};

const translations: Record<string, Record<string, string>> = {
  en: {
    settings: "Settings",
    general: "General",
    installDir: "Default Install Directory",
    browse: "Browse",
    cdnUrl: "BunnyCDN Pull Zone URL",
    cdnUrlDesc: "Public CDN URL for covers, banners, downloads.",
    storageZone: "Storage Zone Name",
    storageZoneDesc: "Your BunnyCDN storage zone name.",
    apiKey: "Storage API Key",
    apiKeyDesc: "Dashboard → Storage → zone → FTP & API Access. Use the Password.",
    language: "Language",
    goldberg: "Goldberg Emulator",
    goldbergDesc: "Enable achievements in games via Goldberg Steam Emulator. Point to the folder containing lib/steam_api64.dll etc.",
    rawg: "RAWG API",
    rawgDesc: "Auto-fetch game metadata (descriptions, ratings, platforms). Get a free key at",
    appearance: "Appearance",
    theme: "Theme",
    themeDesc: "Sakura Dark / Sakura Light",
    dark: "Dark",
    light: "Light",
    danger: "Danger Zone",
    clearLib: "Clear Library",
    clearLibDesc: "Remove all games. Irreversible.",
    clear: "Clear",
    save: "Save Settings",
    saved: "✓ Settings Saved!",
    loading: "Loading settings...",
    version: "games in library",
    failSave: "Save failed: ",
    confirmClear1: "Remove ALL games? This cannot be undone.",
    confirmClear2: "Are you SURE?",
    goldbergPlaceholder: "/path/to/goldberg",
    rawgPlaceholder: "Enter your RAWG API key",
  },
  cs: {
    settings: "Nastavení",
    general: "Obecné",
    installDir: "Výchozí adresář pro instalaci",
    browse: "Procházet",
    cdnUrl: "BunnyCDN Pull Zone URL",
    cdnUrlDesc: "Veřejná CDN adresa pro obaly, banery a stahování.",
    storageZone: "Název Storage Zone",
    storageZoneDesc: "Název vaší BunnyCDN storage zóny.",
    apiKey: "Storage API klíč",
    apiKeyDesc: "Dashboard → Storage → zóna → FTP & API Access. Použijte heslo.",
    language: "Jazyk",
    goldberg: "Goldberg Emulátor",
    goldbergDesc: "Povolí achievementy ve hrách pomocí Goldberg Steam Emulátoru. Nastavte cestu ke složce obsahující lib/steam_api64.dll atd.",
    rawg: "RAWG API",
    rawgDesc: "Automatické načítání metadat her (popisy, hodnocení, platformy). Získejte klíč zdarma na",
    appearance: "Vzhled",
    theme: "Motiv",
    themeDesc: "Sakura Tmavý / Sakura Světlý",
    dark: "Tmavý",
    light: "Světlý",
    danger: "Nebezpečná zóna",
    clearLib: "Vymazat knihovnu",
    clearLibDesc: "Odstraní všechny hry. Nevratné.",
    clear: "Vymazat",
    save: "Uložit nastavení",
    saved: "✓ Nastavení uloženo!",
    loading: "Načítání nastavení...",
    version: "her v knihovně",
    failSave: "Uložení selhalo: ",
    confirmClear1: "Odstranit VŠECHNY hry? Toto nelze vrátit.",
    confirmClear2: "Jste si OPRAVDU jistá?",
    goldbergPlaceholder: "/cesta/k/goldberg",
    rawgPlaceholder: "Zadejte váš RAWG API klíč",
  },
  hi: {
    settings: "सेटिंग्स",
    general: "सामान्य",
    installDir: "डिफ़ॉल्ट इंस्टॉल निर्देशिका",
    browse: "ब्राउज़ करें",
    cdnUrl: "BunnyCDN पुल ज़ोन URL",
    cdnUrlDesc: "कवर, बैनर और डाउनलोड के लिए सार्वजनिक CDN URL।",
    storageZone: "स्टोरेज ज़ोन का नाम",
    storageZoneDesc: "आपकी BunnyCDN स्टोरेज ज़ोन का नाम।",
    apiKey: "Storage API कुंजी",
    apiKeyDesc: "Dashboard → Storage → ज़ोन → FTP & API Access. पासवर्ड का उपयोग करें।",
    language: "भाषा",
    goldberg: "गोल्डबर्ग एमुलेटर",
    goldbergDesc: "गोल्डबर्ग स्टीम एमुलेटर के माध्यम से गेम में उपलब्धियां सक्षम करें। lib/steam_api64.dll वाले फ़ोल्डर का पथ सेट करें।",
    rawg: "RAWG API",
    rawgDesc: "गेम मेटाडेटा (विवरण, रेटिंग, प्लेटफ़ॉर्म) स्वचालित रूप से प्राप्त करें। मुफ्त कुंजी प्राप्त करें",
    appearance: "दिखावट",
    theme: "थीम",
    themeDesc: "सकुरा डार्क / सकुरा लाइट",
    dark: "डार्क",
    light: "लाइट",
    danger: "खतरे का क्षेत्र",
    clearLib: "लाइब्रेरी साफ़ करें",
    clearLibDesc: "सभी गेम हटाएं। अपरिवर्तनीय।",
    clear: "साफ़ करें",
    save: "सेटिंग्स सहेजें",
    saved: "✓ सेटिंग्स सहेजी गईं!",
    loading: "सेटिंग्स लोड हो रही हैं...",
    version: "लाइब्रेरी में गेम",
    failSave: "सहेजना विफल: ",
    confirmClear1: "सभी गेम हटाएं? यह पूर्ववत नहीं किया जा सकता।",
    confirmClear2: "क्या आपको पक्का यकीन है?",
    goldbergPlaceholder: "/goldberg/का/पथ",
    rawgPlaceholder: "अपनी RAWG API कुंजी दर्ज करें",
  },
  ru: {
    settings: "Настройки",
    general: "Общие",
    installDir: "Каталог установки по умолчанию",
    browse: "Обзор",
    cdnUrl: "BunnyCDN Pull Zone URL",
    cdnUrlDesc: "Публичный CDN URL для обложек, баннеров и загрузок.",
    storageZone: "Имя Storage Zone",
    storageZoneDesc: "Имя вашей BunnyCDN storage зоны.",
    apiKey: "Storage API ключ",
    apiKeyDesc: "Dashboard → Storage → зона → FTP & API Access. Используйте пароль.",
    language: "Язык",
    goldberg: "Эмулятор Голдберга",
    goldbergDesc: "Включите достижения в играх через эмулятор Steam Голдберга. Укажите путь к папке с lib/steam_api64.dll и т.д.",
    rawg: "RAWG API",
    rawgDesc: "Автоматическое получение метаданных игр (описания, рейтинги, платформы). Получите бесплатный ключ на",
    appearance: "Внешний вид",
    theme: "Тема",
    themeDesc: "Sakura Тёмная / Sakura Светлая",
    dark: "Тёмная",
    light: "Светлая",
    danger: "Опасная зона",
    clearLib: "Очистить библиотеку",
    clearLibDesc: "Удалить все игры. Необратимо.",
    clear: "Очистить",
    save: "Сохранить настройки",
    saved: "✓ Настройки сохранены!",
    loading: "Загрузка настроек...",
    version: "игр в библиотеке",
    failSave: "Ошибка сохранения: ",
    confirmClear1: "Удалить ВСЕ игры? Это нельзя отменить.",
    confirmClear2: "Вы УВЕРЕНЫ?",
    goldbergPlaceholder: "/путь/к/goldberg",
    rawgPlaceholder: "Введите ваш RAWG API ключ",
  },
  uk: {
    settings: "Налаштування",
    general: "Загальні",
    installDir: "Каталог встановлення за замовчуванням",
    browse: "Огляд",
    cdnUrl: "BunnyCDN Pull Zone URL",
    cdnUrlDesc: "Публічний CDN URL для обкладинок, банерів та завантажень.",
    storageZone: "Назва Storage Zone",
    storageZoneDesc: "Назва вашої BunnyCDN storage зони.",
    apiKey: "Storage API ключ",
    apiKeyDesc: "Dashboard → Storage → зона → FTP & API Access. Використовуйте пароль.",
    language: "Мова",
    goldberg: "Емулятор Голдберга",
    goldbergDesc: "Увімкніть досягнення в іграх через емулятор Steam Голдберга. Вкажіть шлях до папки з lib/steam_api64.dll тощо.",
    rawg: "RAWG API",
    rawgDesc: "Автоматичне отримання метаданих ігор (описи, рейтинги, платформи). Отримайте безкоштовний ключ на",
    appearance: "Зовнішній вигляд",
    theme: "Тема",
    themeDesc: "Sakura Темна / Sakura Світла",
    dark: "Темна",
    light: "Світла",
    danger: "Небезпечна зона",
    clearLib: "Очистити бібліотеку",
    clearLibDesc: "Видалити всі ігри. Безповоротно.",
    clear: "Очистити",
    save: "Зберегти налаштування",
    saved: "✓ Налаштування збережено!",
    loading: "Завантаження налаштувань...",
    version: "ігор у бібліотеці",
    failSave: "Помилка збереження: ",
    confirmClear1: "Видалити ВСІ ігри? Це не можна скасувати.",
    confirmClear2: "Ви ВПЕВНЕНІ?",
    goldbergPlaceholder: "/шлях/до/goldberg",
    rawgPlaceholder: "Введіть ваш RAWG API ключ",
  },
  ja: {
    settings: "設定",
    general: "一般",
    installDir: "デフォルトのインストールディレクトリ",
    browse: "参照",
    cdnUrl: "BunnyCDN プルゾーンURL",
    cdnUrlDesc: "カバー、バナー、ダウンロード用の公開CDN URL。",
    storageZone: "ストレージゾーン名",
    storageZoneDesc: "あなたのBunnyCDNストレージゾーン名。",
    apiKey: "Storage APIキー",
    apiKeyDesc: "Dashboard → Storage → ゾーン → FTP & API Access。パスワードを使用してください。",
    language: "言語",
    goldberg: "Goldberg エミュレーター",
    goldbergDesc: "Goldberg Steam Emulatorでゲームの実績を有効にします。lib/steam_api64.dllなどを含むフォルダーを指定してください。",
    rawg: "RAWG API",
    rawgDesc: "ゲームメタデータ（説明、評価、プラットフォーム）を自動取得。無料キーを取得",
    appearance: "外観",
    theme: "テーマ",
    themeDesc: "Sakura ダーク / Sakura ライト",
    dark: "ダーク",
    light: "ライト",
    danger: "危険ゾーン",
    clearLib: "ライブラリをクリア",
    clearLibDesc: "すべてのゲームを削除します。元に戻せません。",
    clear: "クリア",
    save: "設定を保存",
    saved: "✓ 設定を保存しました！",
    loading: "設定を読み込み中...",
    version: "ライブラリのゲーム数",
    failSave: "保存に失敗しました: ",
    confirmClear1: "すべてのゲームを削除しますか？これは元に戻せません。",
    confirmClear2: "本当によろしいですか？",
    goldbergPlaceholder: "/goldberg/への/パス",
    rawgPlaceholder: "RAWG APIキーを入力",
  },
};

function t(key: string, lang: string): string {
  return translations[lang]?.[key] || translations["en"]?.[key] || key;
}

export default function Settings() {
  const { games } = useGameStore();
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const lang = settings.language;

  useEffect(() => {
    (async () => {
      try {
        const s = await invoke<AppSettings>("load_settings");
        if (s) {
          setSettings({ ...defaults, ...s });
          setLanguage(s.language || "en");
        }
      } catch (e) {
        console.error("Load settings failed:", e);
      }
      setLoaded(true);
    })();
  }, []);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSettings((s) => {
      const next = { ...s, [k]: v };
      if (k === "language") setLanguage(v as string);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(t("failSave", lang) + String(e));
    }
  };

  const handlePickInstallDir = async () => {
    const path = await open({ directory: true, title: "Default Install Directory" });
    if (path) set("install_dir", path as string);
  };

  const handleClearLibrary = async () => {
    if (!confirm(t("confirmClear1", lang))) return;
    if (!confirm(t("confirmClear2", lang))) return;
    for (const game of games) {
      try {
        await invoke("remove_game", { id: game.id });
      } catch (e) {
        console.error(e);
      }
    }
    window.location.hash = "#/library";
    window.location.reload();
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full text-sakura-muted">
        {t("loading", lang)}
      </div>
    );
  }

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="page-container"
    >
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent flex items-center gap-2 mb-6">
          <SettingsIcon size={20} />
          {t("settings", lang)}
        </h1>

        <section className="glass-card p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-sakura-pink uppercase tracking-wider">{t("general", lang)}</h2>

          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              {t("installDir", lang)}
            </label>
            <div className="flex gap-2">
              <input
                className="sakura-input"
                placeholder="/home/user/Games"
                value={settings.install_dir}
                onChange={(e) => set("install_dir", e.target.value)}
              />
              <button onClick={handlePickInstallDir} className="sakura-btn-ghost px-3 flex-shrink-0 flex items-center gap-1.5 text-sm">
                <FolderOpen size={14} /> {t("browse", lang)}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              {t("cdnUrl", lang)}
            </label>
            <input
              className="sakura-input"
              placeholder="https://your-zone.b-cdn.net"
              value={settings.bunnycdn_base_url}
              onChange={(e) => set("bunnycdn_base_url", e.target.value)}
            />
            <p className="text-xs text-sakura-muted mt-1">{t("cdnUrlDesc", lang)}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              {t("storageZone", lang)}
            </label>
            <input
              className="sakura-input"
              placeholder="my-games-zone"
              value={settings.bunnycdn_storage_zone}
              onChange={(e) => set("bunnycdn_storage_zone", e.target.value)}
            />
            <p className="text-xs text-sakura-muted mt-1">{t("storageZoneDesc", lang)}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              {t("apiKey", lang)}
            </label>
            <input
              className="sakura-input"
              type="password"
              placeholder="••••••••-••••-••••-••••-••••••••••••"
              value={settings.bunnycdn_api_key}
              onChange={(e) => set("bunnycdn_api_key", e.target.value)}
            />
            <p className="text-xs text-sakura-muted mt-1">
              {t("apiKeyDesc", lang)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">{t("language", lang)}</label>
            <select value={settings.language} onChange={(e) => set("language", e.target.value)} className="sakura-input w-auto">
              <option value="en">English</option>
              <option value="cs">Čeština</option>
              <option value="hi">हिन्दी</option>
              <option value="ru">Русский</option>
              <option value="uk">Українська</option>
              <option value="ja">Japanese</option>
              <option value="neko">🐱 Neko</option>
              <option value="puppy">🐶 Puppy</option>
            </select>
          </div>
        </section>

        <section className="glass-card p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-sakura-pink uppercase tracking-wider">{t("goldberg", lang)}</h2>
          <p className="text-xs text-sakura-muted">
            {t("goldbergDesc", lang)}
          </p>
          <input
            className="sakura-input"
            placeholder={t("goldbergPlaceholder", lang)}
            value={settings.goldberg_path ?? ''}
            onChange={(e) => set('goldberg_path', e.target.value || undefined)}
          />
        </section>

        <section className="glass-card p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-sakura-pink uppercase tracking-wider">{t("rawg", lang)}</h2>
          <p className="text-xs text-sakura-muted">
            {t("rawgDesc", lang)}{' '}
            <a href="https://rawg.io/apidocs" className="text-sakura-pink underline" target="_blank" rel="noopener noreferrer">rawg.io/apidocs</a>
          </p>
          <input
            className="sakura-input"
            placeholder={t("rawgPlaceholder", lang)}
            value={settings.rawg_api_key ?? ''}
            onChange={(e) => set('rawg_api_key', e.target.value || undefined)}
          />
        </section>

        <section className="glass-card p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-sakura-pink uppercase tracking-wider">{t("appearance", lang)}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sakura-text">{t("theme", lang)}</p>
              <p className="text-xs text-sakura-muted mt-0.5">{t("themeDesc", lang)}</p>
            </div>
            <button
              onClick={() => set("theme", settings.theme === "dark" ? "light" : "dark")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm ${
                settings.theme === "dark"
                  ? "border-sakura-purple/40 text-sakura-purple bg-sakura-purple/10"
                  : "border-yellow-400/40 text-yellow-400 bg-yellow-400/10"
              }`}
            >
              {settings.theme === "dark" ? <><Moon size={14} /> {t("dark", lang)}</> : <><Sun size={14} /> {t("light", lang)}</>}
            </button>
          </div>
        </section>

        <section className="glass-card p-5 mb-4 space-y-4 border-red-500/20">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">{t("danger", lang)}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sakura-text">{t("clearLib", lang)}</p>
              <p className="text-xs text-sakura-muted mt-0.5">{t("clearLibDesc", lang)}</p>
            </div>
            <button
              onClick={handleClearLibrary}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all text-sm"
            >
              <Trash2 size={14} /> {t("clear", lang)}
            </button>
          </div>
        </section>

        <button
          onClick={handleSave}
          className={`sakura-btn w-full flex items-center justify-center gap-2 ${saved ? "bg-green-500 from-green-500 to-green-500" : ""}`}
        >
          {saved ? t("saved", lang) : t("save", lang)}
        </button>

        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-sakura-muted">
          <Info size={12} />
          <span>Sakura Launcher v0.1.0 · {games.length} {t("version", lang)}</span>
        </div>
      </div>
    </motion.div>
  );
}
