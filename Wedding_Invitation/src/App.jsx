import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Heart, MapPin, Music2, Pause, Send, X } from "lucide-react";
import { coupleName, wedding } from "./data/wedding";
import { supabase } from "./lib/supabase";

const countdownLabels = Object.keys(wedding.copy.countdownLabels);

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
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const [countdown, setCountdown] = useState(() => getCountdown());
  const [wishDialogOpen, setWishDialogOpen] = useState(false);
  const [wishName, setWishName] = useState("");
  const [wishMessage, setWishMessage] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishError, setWishError] = useState("");
  const [wishes, setWishes] = useState([]);
  const [wishShowcaseOpen, setWishShowcaseOpen] = useState(false);
  const [wishIndex, setWishIndex] = useState(0);
  const [wishCycle, setWishCycle] = useState(0);
  const audioRef = useRef(null);

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
    };

    void loadWishes();
    const channel = supabase
      .channel("public-wedding-wishes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wedding_wishes" }, ({ new: wish }) => {
        setWishes((currentWishes) => {
          if (currentWishes.some((currentWish) => currentWish.id === wish.id)) return currentWishes;
          return [...currentWishes, wish].sort((first, second) => new Date(first.created_at) - new Date(second.created_at)).slice(-100);
        });
        setWishShowcaseOpen(true);
      })
      .subscribe();

    return () => {
      isMounted = false;
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
    if (wishes.length === 0 || !wishShowcaseOpen) return undefined;
    const timer = setInterval(() => {
      setWishIndex((index) => (index + 1) % wishes.length);
      setWishCycle((cycle) => cycle + 1);
    }, 6500);
    return () => clearInterval(timer);
  }, [wishes.length, wishShowcaseOpen]);

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
  };

  const sendWish = async (event) => {
    event.preventDefault();
    const wish = { name: wishName.trim(), message: wishMessage.trim() };
    if (!wish.name || !wish.message || wishSubmitting) return;
    setWishSubmitting(true);
    setWishError("");
    try {
      let submittedWish = wish;
      if (supabase) {
        const { data, error } = await supabase
          .from("wedding_wishes")
          .insert(wish)
          .select("id, name, message, created_at")
          .single();
        if (error) throw error;
        submittedWish = data;
      }
      setWishes((currentWishes) => currentWishes.some((currentWish) => currentWish.id && currentWish.id === submittedWish.id)
        ? currentWishes
        : [...currentWishes, submittedWish]);
      setWishIndex(wishes.length);
      setWishCycle((cycle) => cycle + 1);
      setWishShowcaseOpen(true);
      setWishName("");
      setWishMessage("");
      setWishDialogOpen(false);
    } catch {
      setWishError(wedding.copy.wishSubmitError);
    } finally {
      setWishSubmitting(false);
    }
  };

  const toggleMusic = async () => {
    if (!audioRef.current || !wedding.media.music || musicUnavailable) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setMusicUnavailable(true);
    }
  };

  return (
    <main className="invite-shell" id="top">
      <section className={`cover ${opened ? "is-open" : "is-closed"}`} aria-label={wedding.copy.coverAria}>
        <img className="cover__image" src={wedding.media.cover} alt={wedding.media.coverDescription} fetchPriority="high" />
        <div className="cover__veil" />
        <div className="cover__rule" aria-hidden="true"><span>✳</span></div>
        <div className="cover__content">
          <p className="eyebrow cover__eyebrow">{wedding.copy.coverEyebrow}</p>
          <p className="cover__invitation">{wedding.copy.coverIntro}</p>
          <h1 className="cover__names shine">{coupleName}</h1>
          <span className="cover__ampersand" aria-hidden="true">&</span>
          <p className="cover__date">{wedding.date.display}<span>{wedding.date.day} · {wedding.date.time}</span></p>
          <button className="open-button" onClick={openInvite} type="button"><span>{wedding.copy.openButton}</span><ArrowDown size={15} /></button>
        </div>
        <p className="cover__side-note" aria-hidden="true">{wedding.copy.coverSideNote}</p>
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
        <div className="story__image-wrap"><img src={wedding.media.photos[0]} alt={wedding.media.photoDescriptions[0]} loading="lazy" /><span>{wedding.copy.storyImageNote}</span></div>
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
        <div className="venue__details"><span>{wedding.date.display}</span><i>✳</i><span>{wedding.date.time}</span></div>
        <a className="map-button" href={wedding.venue.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} />{wedding.copy.mapButton}<ArrowUpRight size={14} /></a>
      </section>

      <section className="closing section reveal">
        <p className="eyebrow">{wedding.copy.closingEyebrow}</p>
        <h2>{wedding.copy.closingHeading}</h2>
        <p>{wedding.copy.closingText}</p>
        <button className="share-button" onClick={() => setWishDialogOpen(true)} type="button"><Heart size={16} />{wedding.copy.wishButton}<ArrowUpRight size={14} /></button>
        <p className="closing__names">{coupleName}</p>
      </section>

      <footer className="footer"><a href="#top" className="footer__monogram" aria-label={wedding.copy.backToTop}>{wedding.couple.bride[0]}<i>&</i>{wedding.couple.groom[0]}</a><p>{wedding.copy.footerText.replace("{couple}", coupleName)}</p><a className="footer__top" href="#top" aria-label={wedding.copy.backToTop}><ArrowUpRight size={16} /></a></footer>

      <button className={`music-button ${playing ? "is-playing" : ""}`} onClick={toggleMusic} type="button" disabled={musicUnavailable} aria-label={musicUnavailable ? wedding.copy.musicUnavailable : playing ? wedding.copy.pauseMusic : wedding.copy.playMusic} title={musicUnavailable ? wedding.copy.musicUnavailable : playing ? wedding.copy.pauseMusic : wedding.copy.playMusic}>
        {playing ? <Pause size={17} /> : <Music2 size={18} />}
        <span>{musicUnavailable ? wedding.copy.musicUnavailable : playing ? wedding.copy.musicOn : wedding.copy.musicOff}</span>
        {playing && <i className="music-button__equalizer" aria-hidden="true"><b /><b /><b /></i>}
      </button>
      <audio ref={audioRef} src={wedding.media.music} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setMusicUnavailable(true); }} />

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

      {wishes.length > 0 && wishShowcaseOpen && !wishDialogOpen && (
        <section className="wish-showcase" aria-label={wedding.copy.wishesAria} aria-live="polite">
          <button className="wish-showcase__close" type="button" onClick={() => setWishShowcaseOpen(false)} aria-label={wedding.copy.closeWishes}><X size={19} /></button>
          <div className="wish-showcase__card" key={`${wishIndex}-${wishCycle}`}>
            <p>{wishes[wishIndex].message}</p>
            <span>{wedding.copy.wishFrom} {wishes[wishIndex].name}</span>
          </div>
          <button className="wish-showcase__send" type="button" onClick={() => setWishDialogOpen(true)}><Heart size={15} />{wedding.copy.wishButton}</button>
        </section>
      )}
    </main>
  );
}

export default App;