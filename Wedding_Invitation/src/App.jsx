import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, MapPin, Music2, Pause, Share2, Sparkles } from "lucide-react";
import { coupleName, wedding } from "./data/wedding";

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

function ScratchCard({ onReveal }) {
  const canvasRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const isScratching = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = bounds.width * ratio;
    canvas.height = bounds.height * ratio;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.scale(ratio, ratio);
    context.fillStyle = "#bd9861";
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = "rgba(255, 246, 225, .22)";
    context.lineWidth = 1;
    for (let x = -bounds.height; x < bounds.width; x += 12) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + bounds.height, bounds.height);
      context.stroke();
    }
  }, []);

  const scratch = (event) => {
    if (!isScratching.current || revealed) return;
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(event.clientX - bounds.left, event.clientY - bounds.top, 21, 0, Math.PI * 2);
    context.fill();

    if (Date.now() - lastCheck.current < 180) return;
    lastCheck.current = Date.now();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let index = 3; index < pixels.length; index += 4 * 16) {
      if (pixels[index] === 0) transparent += 1;
    }
    if (transparent / (pixels.length / (4 * 16)) > 0.42) {
      setRevealed(true);
      onReveal();
    }
  };

  return (
    <div className={`scratch-card ${revealed ? "is-revealed" : ""}`}>
      <div className="scratch-card__secret" aria-live="polite">
        <span className="scratch-card__day">{wedding.date.day}</span>
        <strong>{wedding.date.display}</strong>
        <span>{wedding.date.time} <i>·</i> {wedding.venue.name}</span>
      </div>
      {!revealed && (
        <canvas
          aria-label={wedding.copy.scratchHint}
          className="scratch-card__canvas"
          ref={canvasRef}
          onPointerDown={(event) => {
            isScratching.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            scratch(event);
          }}
          onPointerMove={scratch}
          onPointerUp={() => { isScratching.current = false; }}
          onPointerCancel={() => { isScratching.current = false; }}
        />
      )}
      {!revealed && <span className="scratch-card__hint"><Sparkles size={15} />{wedding.copy.scratchHint}</span>}
      {revealed && <div className="petal-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ "--petal-index": index }} />)}</div>}
    </div>
  );
}

function App() {
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const [countdown, setCountdown] = useState(() => getCountdown());
  const [dateRevealed, setDateRevealed] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    window.setTimeout(() => document.getElementById("welcome")?.scrollIntoView({ behavior: "smooth" }), 650);
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

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${wedding.copy.shareText} ${coupleName} · ${wedding.date.display} · ${wedding.venue.name}`)}`;

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
        <a className="cover__scroll" href="#welcome" aria-label={wedding.copy.scrollLabel}><span>{wedding.copy.scrollLabel}</span><i><ArrowDown size={14} /></i></a>
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

      <section className="date-section section reveal" id="the-date">
        <div className="date-section__copy">
          <p className="eyebrow">{wedding.copy.dateEyebrow}</p>
          <h2>{wedding.copy.dateHeading}</h2>
          <p>{wedding.copy.scratchDescription}</p>
        </div>
        <ScratchCard onReveal={() => setDateRevealed(true)} />
        <div className={`countdown ${dateRevealed ? "countdown--celebrate" : ""}`} aria-label={wedding.copy.countdownAria}>
          <p className="eyebrow">{wedding.copy.countdownHeading}</p>
          <div className="countdown__grid">{countdownLabels.map((key) => <div className="countdown__unit" key={key}><strong>{countdown[key]}</strong><span>{wedding.copy.countdownLabels[key]}</span></div>)}</div>
        </div>
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
        <div className="venue__details"><span>{wedding.date.display}</span><i>✳</i><span>{wedding.date.time}</span></div>
        <a className="map-button" href={wedding.venue.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} />{wedding.copy.mapButton}<ArrowUpRight size={14} /></a>
      </section>

      <section className="closing section reveal">
        <p className="eyebrow">{wedding.copy.closingEyebrow}</p>
        <h2>{wedding.copy.closingHeading}</h2>
        <p>{wedding.copy.closingText}</p>
        <a className="share-button" href={whatsappUrl} target="_blank" rel="noreferrer"><Share2 size={16} />{wedding.copy.shareButton}<ArrowUpRight size={14} /></a>
        <p className="closing__names">{coupleName}</p>
      </section>

      <footer className="footer"><a href="#top" className="footer__monogram" aria-label={wedding.copy.backToTop}>{wedding.couple.bride[0]}<i>&</i>{wedding.couple.groom[0]}</a><p>{wedding.copy.footerText.replace("{couple}", coupleName)}</p><a className="footer__top" href="#top" aria-label={wedding.copy.backToTop}><ArrowUpRight size={16} /></a></footer>

      <button className={`music-button ${playing ? "is-playing" : ""}`} onClick={toggleMusic} type="button" disabled={musicUnavailable} aria-label={musicUnavailable ? wedding.copy.musicUnavailable : playing ? wedding.copy.pauseMusic : wedding.copy.playMusic} title={musicUnavailable ? wedding.copy.musicUnavailable : playing ? wedding.copy.pauseMusic : wedding.copy.playMusic}>
        {playing ? <Pause size={17} /> : <Music2 size={18} />}
        <span>{musicUnavailable ? wedding.copy.musicUnavailable : playing ? wedding.copy.musicOn : wedding.copy.musicOff}</span>
        {playing && <i className="music-button__equalizer" aria-hidden="true"><b /><b /><b /></i>}
      </button>
      <audio ref={audioRef} src={wedding.media.music} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setMusicUnavailable(true); }} />
    </main>
  );
}

export default App;