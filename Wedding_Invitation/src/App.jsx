import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Heart, MapPin, Music2, Pause, Send, X } from "lucide-react";
import { coupleName, wedding } from "./data/wedding";
import { supabase } from "./lib/supabase";

const countdownLabels = Object.keys(wedding.copy.countdownLabels);
const wishPastels = ["#F5EAC6", "#DCE8D5", "#DCE9EF", "#F1DDDF", "#E7E0F1"];

function getNextWishPastel(currentIndex) {
  if (wishPastels.length < 2) return 0;
  const options = wishPastels.map((_, index) => index).filter((index) => index !== currentIndex);
  return options[Math.floor(Math.random() * options.length)];
}

function getWishSubmitErrorMessage(error) {
  if (error instanceof TypeError) {
    return "Could not connect to Supabase. Check that VITE_SUPABASE_URL is the correct, active project URL.";
  }
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    return "The wedding_wishes table is missing. Run supabase/schema.sql in the Supabase SQL Editor.";
  }
  if (error?.code === "42501") {
    return "Supabase denied this wish. Check the wedding_wishes insert policy and permissions.";
  }
  return wedding.copy.wishSubmitError;
}

function CoverDivider({ variant }) {
  return (
    <div className={`cover__ornament cover__ornament--${variant}`} aria-hidden="true">
      <span className="cover__ornament-line" />
      <svg viewBox="0 0 48 24" fill="none">
        <g stroke="currentColor" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 22C24 15 24 8 24 2" />
          <path d="M24 17C19 17 16 14 13 10C18 10 22 12 24 16" />
          <path d="M24 17C29 17 32 14 35 10C30 10 26 12 24 16" />
          <path d="M24 11C20 11 17.5 8 16 5C20 5 23 7.5 24 10" />
          <path d="M24 11C28 11 30.5 8 32 5C28 5 25 7.5 24 10" />
          <path d="M24 6C21 5.5 19 3.5 18.5 1.5C21.5 1.5 23 3.2 24 5" />
          <path d="M24 6C27 5.5 29 3.5 29.5 1.5C26.5 1.5 25 3.2 24 5" />
        </g>
      </svg>
      <span className="cover__ornament-line" />
    </div>
  );
}

function getCountdown() {
  const difference = new Date(wedding.date.iso).getTime() - Date.now();
  if (difference <= 0) return { days: "00", hours: "00", minutes: "00", seconds: "00" };
  return {
    days: String(Math.floor(difference / 86400000)).padStart(2, "0"),
    hours: String(Math.floor(difference / 3600000) % 24).padStart(2, "0"),
    minutes: String(Math.floor(difference / 60000) % 60).padStart(2, "0"),
    seconds: String(Math.floor(difference / 1000) % 60).padStart(2, "0"),
  };
}

function App() {
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicPlaybackError, setMusicPlaybackError] = useState(false);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const [countdown, setCountdown] = useState(() => getCountdown());
  const [wishDialogOpen, setWishDialogOpen] = useState(false);
  const [wishName, setWishName] = useState("");
  const [wishMessage, setWishMessage] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishError, setWishError] = useState("");
  const [wishes, setWishes] = useState([]);
  const [wishIndex, setWishIndex] = useState(0);
  const [wishPastelIndex, setWishPastelIndex] = useState(() => Math.floor(Math.random() * wishPastels.length));
  const audioRef = useRef(null);
  const musicMutedRef = useRef(false);
  const startMusicRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    let playRequested = false;
    let isMounted = true;

    audio.volume = 0.2;
    audio.muted = musicMutedRef.current;

    const startMusic = async () => {
      if (!isMounted || audio.error || !audio.paused || musicMutedRef.current || playRequested) return;
      playRequested = true;
      try {
        await audio.play();
        if (isMounted) {
          setMusicPlaybackError(false);
        }
      } catch (error) {
        if (!isMounted || error?.name === "AbortError") return;
        console.error("Wedding music could not be played.", error);
        setMusicPlaybackError(true);
      } finally {
        playRequested = false;
      }
    };
    startMusicRef.current = startMusic;

    return () => {
      isMounted = false;
      startMusicRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => { window.history.scrollRestoration = previousScrollRestoration; };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("cover-lock", !opened);
    return () => document.documentElement.classList.remove("cover-lock");
  }, [opened]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let isMounted = true;

    const loadWishes = async () => {
      try {
        const { data, error } = await supabase
          .from("wedding_wishes")
          .select("id, name, message, created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (isMounted && !error && data) {
          setWishes((currentWishes) => {
            const merged = [...currentWishes];
            data.forEach((wish) => {
              if (!merged.some((currentWish) => currentWish.id === wish.id)) merged.push(wish);
            });
            return merged.sort((first, second) => new Date(first.created_at) - new Date(second.created_at)).slice(-100);
          });
        }
      } catch (error) {
        console.warn("Wedding wishes are unavailable right now.", error);
      }
    };

    void loadWishes();
    const channel = supabase
      .channel("public-wedding-wishes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wedding_wishes" }, ({ new: wish }) => {
        setWishes((currentWishes) => {
          if (currentWishes.some((currentWish) => currentWish.id === wish.id)) return currentWishes;
          return [...currentWishes, wish].sort((first, second) => new Date(first.created_at) - new Date(second.created_at)).slice(-100);
        });
      });

    const subscription = channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("Realtime wishlist subscription unavailable.");
      }
    });

    return () => {
      isMounted = false;
      void subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!wishDialogOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setWishDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [wishDialogOpen]);

  useEffect(() => {
    if (wishes.length < 2) return undefined;

    const timer = setInterval(() => {
      setWishIndex((index) => (index + 1) % wishes.length);
      setWishPastelIndex((index) => getNextWishPastel(index));
    }, 3500);
    return () => clearInterval(timer);
  }, [wishes.length]);

  useEffect(() => {
    document.title = wedding.copy.pageTitle.replace("{couple}", coupleName);
    document.querySelector('meta[name="description"]')?.setAttribute("content", wedding.copy.metaDescription.replace("{couple}", coupleName).replace("{date}", wedding.date.display).replace("{venue}", wedding.venue.name));
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", wedding.copy.pageTitle.replace("{couple}", coupleName));
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", wedding.copy.metaDescription.replace("{couple}", coupleName).replace("{date}", wedding.date.display).replace("{venue}", wedding.venue.name));
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", wedding.media.cover);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    document.querySelectorAll(".reveal").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const openInvite = () => {
    setOpened(true);
    void startMusicRef.current?.();
  };

  const sendWish = async (event) => {
    event.preventDefault();
    const wish = { name: wishName.trim(), message: wishMessage.trim() };
    if (!wish.name || !wish.message || wishSubmitting) return;

    if (!supabase) {
      setWishError("Wishes are currently unavailable because Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment, and make sure VITE_ENABLE_SUPABASE is not set to false.");
      return;
    }

    setWishSubmitting(true);
    setWishError("");
    try {
      const { data, error } = await supabase
        .from("wedding_wishes")
        .insert(wish)
        .select("id, name, message, created_at")
        .single();

      if (error) throw error;

      setWishes((currentWishes) => {
        if (currentWishes.some((currentWish) => currentWish.id && currentWish.id === data.id)) return currentWishes;
        return [...currentWishes, data];
      });
      setWishIndex((currentIndex) => (currentIndex + 1) % Math.max(wishes.length, 1));
      setWishPastelIndex((index) => getNextWishPastel(index));
      setWishName("");
      setWishMessage("");
      setWishDialogOpen(false);
    } catch (error) {
      console.error("Failed to submit wedding wish.", error);
      setWishError(getWishSubmitErrorMessage(error));
    } finally {
      setWishSubmitting(false);
    }
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio || !wedding.media.music || musicUnavailable) return;
    if (!audio.paused && !audio.muted) {
      audio.muted = true;
      musicMutedRef.current = true;
      setMusicMuted(true);
      return;
    }
    audio.muted = false;
    musicMutedRef.current = false;
    setMusicMuted(false);
    await startMusicRef.current?.();
  };

  return (
    <main className="invite-shell" id="top">
      <section className={`cover ${opened ? "is-open" : "is-closed"}`} aria-label={wedding.copy.coverAria}>
        <img className="cover__image" src={wedding.media.cover} alt={wedding.media.coverDescription} fetchPriority="high" />
        <div className="cover__veil" />
        <div className="cover__rule" aria-hidden="true" />
        <div className="cover__content">
          <p className="eyebrow cover__eyebrow">{wedding.copy.coverEyebrow}</p>
          <CoverDivider variant="flower" />
          <p className="cover__invitation">joyfully invite you to celebrate their wedding</p>
          <h1 className="cover__names shine">Arun &amp; Anjali</h1>
          <span className="cover__ampersand" aria-hidden="true">&</span>
          <CoverDivider variant="sprig" />
          <p className="cover__date"><span>SUNDAY &#183; 12:00 PM</span><span>25 OCTOBER 2026</span></p>
          <p className="cover__motto">JOIN US FOR A CELEBRATION OF LOVE, FAMILY &amp; TOGETHERNESS</p>
          <CoverDivider variant="bottom" />
          <button className="open-button" onClick={openInvite} type="button"><span>{wedding.copy.openButton}</span><ArrowDown size={15} /></button>
        </div>
      </section>

      <section className="welcome section reveal" id="welcome">
        <div className="section-flower" aria-hidden="true">✳</div>
        <p className="eyebrow">{wedding.copy.welcomeEyebrow}</p>
        <h2>{wedding.copy.welcomeHeading}</h2>
        <p className="welcome__names">{coupleName}</p>
        <p className="welcome__message">{wedding.message}</p>
        <span className="gold-line" aria-hidden="true" />
        <p className="welcome__family">{wedding.copy.familyNote}</p>
      </section>

      <section className="story section reveal" id="our-story">
        <div className="story__image-wrap"><img src={wedding.media.storyImage} alt={wedding.media.storyImageDescription} loading="lazy" /><span>{wedding.copy.storyImageNote}</span></div>
        <div className="story__copy"><p className="eyebrow">{wedding.copy.storyEyebrow}</p><h2>{wedding.copy.storyHeading}</h2><p>{wedding.copy.storyText}</p><span className="gold-line" aria-hidden="true" /><p className="story__signature">{coupleName}</p></div>
        <figure className="story__portrait"><img src={wedding.media.photos[1]} alt={wedding.media.photoDescriptions[1]} loading="lazy" /><figcaption>{wedding.copy.storyCaption}</figcaption></figure>
      </section>

      <section className="gallery-section section reveal" id="gallery">
        <div className="gallery-heading"><div><p className="eyebrow">{wedding.copy.galleryEyebrow}</p><h2>{wedding.copy.galleryHeading}</h2></div><span>{wedding.copy.galleryNote}</span></div>
        <div className="gallery">{wedding.media.photos.map((photo, index) => <figure className={`gallery__item gallery__item--${index + 1}`} key={`${photo}-${index}`}><img src={photo} alt={wedding.media.photoDescriptions[index]} loading="lazy" /><figcaption>0{index + 1}</figcaption></figure>)}</div>
      </section>

      <section className="venue section reveal" id="venue">
        <div className="venue__mark"><MapPin size={21} strokeWidth={1.2} /></div>
        <p className="eyebrow">{wedding.copy.venueEyebrow}</p>
        <h2>{wedding.venue.name}</h2>
        <p className="venue__address">{wedding.venue.address}</p>
        <p className="venue__note">{wedding.copy.venueNote}</p>
        <div className="venue__countdown" aria-label={wedding.copy.countdownAria}>
          <p className="eyebrow">{wedding.copy.countdownHeading}</p>
          <div className="venue__countdown-grid">{countdownLabels.map((key) => <div className="venue__countdown-unit" key={key}><strong>{countdown[key]}</strong><span>{wedding.copy.countdownLabels[key]}</span></div>)}</div>
        </div>
        <div className="venue__details"><span>{wedding.date.display}</span><i>âœ³</i><span>{wedding.date.time}</span></div>
        <a className="map-button" href={wedding.venue.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} />{wedding.copy.mapButton}<ArrowUpRight size={14} /></a>
      </section>

      <section className="closing section reveal">
        <p className="eyebrow">{wedding.copy.closingEyebrow}</p>
        <h2>{wedding.copy.closingHeading}</h2>
        <p>{wedding.copy.closingText}</p>
        <button className="share-button" onClick={() => setWishDialogOpen(true)} type="button"><Heart size={16} />{wedding.copy.wishButton}<ArrowUpRight size={14} /></button>
        {wishes.length > 0 && (
          <div className="closing__wishes" aria-label={wedding.copy.wishesAria}>
            <p className="eyebrow">{wedding.copy.wishesAria}</p>
            <div className="closing__wish-slider" aria-live="polite">
              <button
                className="closing__wish-nav"
                type="button"
                onClick={() => {
                  setWishIndex((index) => (index - 1 + wishes.length) % wishes.length);
                  setWishPastelIndex((index) => getNextWishPastel(index));
                }}
                aria-label="Show previous wish"
                disabled={wishes.length < 2}
              ><ArrowLeft size={17} /></button>
              <blockquote className="closing__wish-card" key={wishIndex} style={{ backgroundColor: wishPastels[wishPastelIndex], color: "#263d32" }}>
                <p>{wishes[Math.abs(wishIndex) % wishes.length].message}</p>
                <cite>{wedding.copy.wishFrom} {wishes[Math.abs(wishIndex) % wishes.length].name}</cite>
              </blockquote>
              <button
                className="closing__wish-nav"
                type="button"
                onClick={() => {
                  setWishIndex((index) => (index + 1) % wishes.length);
                  setWishPastelIndex((index) => getNextWishPastel(index));
                }}
                aria-label="Show next wish"
                disabled={wishes.length < 2}
              ><ArrowRight size={17} /></button>
            </div>
            <span className="closing__wish-count">{(Math.abs(wishIndex) % wishes.length) + 1} / {wishes.length}</span>
          </div>
        )}
        <p className="closing__names">{coupleName}</p>
      </section>

      <footer className="footer"><a href="#top" className="footer__monogram" aria-label={wedding.copy.backToTop}>{wedding.couple.bride[0]}<i>&</i>{wedding.couple.groom[0]}</a><p>{wedding.copy.footerText.replace("{couple}", coupleName)}</p><a className="footer__top" href="#top" aria-label={wedding.copy.backToTop}><ArrowUpRight size={16} /></a></footer>

      <button className={`music-button ${playing && !musicMuted ? "is-playing" : ""}`} onClick={toggleMusic} type="button" disabled={musicUnavailable} aria-label={musicUnavailable ? wedding.copy.musicUnavailable : playing && !musicMuted ? wedding.copy.pauseMusic : playing && musicMuted ? wedding.copy.musicOn : wedding.copy.playMusic} aria-pressed={playing && !musicMuted} title={musicUnavailable ? wedding.copy.musicUnavailable : playing && !musicMuted ? wedding.copy.pauseMusic : playing && musicMuted ? wedding.copy.musicOn : wedding.copy.playMusic}>
        {playing && !musicMuted ? <Pause size={17} /> : <Music2 size={18} />}
        {playing && !musicMuted && <i className="music-button__equalizer" aria-hidden="true"><b /><b /><b /></i>}
      </button>
      {(musicPlaybackError || musicUnavailable) && <span className="music-button__notice" role="status">{musicUnavailable ? wedding.copy.musicUnavailable : wedding.copy.musicPlaybackError}</span>}
      <audio ref={audioRef} src={wedding.media.music || undefined} preload="metadata" loop onPlay={() => { setPlaying(true); setMusicPlaybackError(false); }} onPause={() => setPlaying(false)} onVolumeChange={(event) => { musicMutedRef.current = event.currentTarget.muted; setMusicMuted(event.currentTarget.muted); }} onError={() => { setPlaying(false); setMusicUnavailable(true); }} />

      {wishDialogOpen && (
        <div className="wish-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWishDialogOpen(false); }}>
          <section className="wish-dialog" role="dialog" aria-modal="true" aria-labelledby="wish-dialog-title">
            <button className="wish-dialog__close" type="button" onClick={() => setWishDialogOpen(false)} aria-label={wedding.copy.closeWishForm}><X size={19} /></button>
            <form onSubmit={sendWish}>
              <label className="wish-dialog__message-label" htmlFor="wish-message">{wedding.copy.wishMessageLabel}</label>
              <textarea id="wish-message" autoFocus maxLength={240} placeholder={wedding.copy.wishMessagePlaceholder} value={wishMessage} onChange={(event) => setWishMessage(event.target.value)} required />
              <h2 id="wish-dialog-title">{wedding.copy.wishDialogTitle}</h2>
              <label className="wish-dialog__name-label" htmlFor="wish-name">{wedding.copy.wishNameLabel}</label>
              <input id="wish-name" autoComplete="name" maxLength={50} placeholder={wedding.copy.wishNamePlaceholder} value={wishName} onChange={(event) => setWishName(event.target.value)} required />
              <div className="wish-dialog__actions">
                <button className="wish-dialog__cancel" type="button" onClick={() => setWishDialogOpen(false)}>{wedding.copy.cancelWish}</button>
                <button className="wish-dialog__submit" type="submit" disabled={wishSubmitting}><Send size={15} />{wishSubmitting ? wedding.copy.sendingWish : wedding.copy.submitWish}<Heart size={14} /></button>
              </div>
              {wishError && <p className="wish-dialog__error" role="alert">{wishError}</p>}
            </form>
          </section>
        </div>
      )}

    </main>
  );
}

export default App;
