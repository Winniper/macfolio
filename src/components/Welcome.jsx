import React, { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import useSystemStore from '../store/system'
import { prefersReducedMotion } from '../lib/boot'

const FONT_WEIGHTS = {
    subtitle: { min: 100, max: 400, default: 100 },
    title: { min: 400, max: 900, default: 400 }
}

const rendertext = (text, className, baseWeight = 400) => {
    return [...text].map((char, i) => (
        <span key={i} className={className} style={{ fontVariationSettings: `'wght' ${baseWeight}` }}>
            {char === " " ? '\u00A0' : char}
        </span>
    ))
}

const setupTextHover = (container, text) => {
    if (!container) return;

    const letters = container.querySelectorAll("span")
    const { min, max, default: base } = FONT_WEIGHTS[text]

    const animateLetter = (letter, weight, duration = 0.25) => {
        return gsap.to(letter, {
            duration,
            ease: "power2.out",
            fontVariationSettings: `'wght' ${weight}`
        })
    }

    const handleMouseMove = (e) => {
        const { left } = container.getBoundingClientRect()
        const mouseX = e.clientX - left;

        letters.forEach((letter) => {
            const { left: l, width: w } = letter.getBoundingClientRect()
            const distance = Math.abs(mouseX - (l - left + w / 2))
            const intensity = Math.exp(-(distance ** 2) / 2000)

            animateLetter(letter, min + (max - min) * intensity)
        })
    }

    const handleMouseLeave = () => { 
        letters.forEach((letter) => {animateLetter(letter, base, 0.3)})
    }
    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mouseleave", handleMouseLeave)

    return () => {
        container.removeEventListener("mousemove", handleMouseMove)
        container.removeEventListener("mouseleave", handleMouseLeave)
    }
}

const Welcome = () => {
    const titleRef = useRef(null)
    const subtitleRef = useRef(null)

    const bootPhase = useSystemStore((state) => state.bootPhase)
    const previousPhaseRef = useRef(bootPhase)
    const entranceRef = useRef(null)

    // Letters stay hidden until the visitor arrives at the desktop, then rise
    // in. A load that starts on the desktop (refresh, small screens) shows them
    // as-is.
    useGSAP(() => {
        const entering = bootPhase === 'desktop' && previousPhaseRef.current !== 'desktop'
        previousPhaseRef.current = bootPhase

        const letters = [titleRef.current, subtitleRef.current]
            .flatMap((element) => [...element.querySelectorAll('span')])
        const reduced = prefersReducedMotion()
        const offset = reduced ? 0 : 24

        if (bootPhase !== 'desktop') {
            // Restart/Lock can come mid-entrance: stop it so the letters really hide.
            // Kill the tween itself; gsap.killTweensOf misses this staggered one.
            entranceRef.current?.kill()
            gsap.set(letters, { opacity: 0, y: offset })
            return
        }

        if (!entering) return

        entranceRef.current = gsap.to(letters, {
            opacity: 1,
            y: 0,
            duration: reduced ? 0.3 : 0.6,
            stagger: reduced ? 0 : 0.02,
            ease: 'power3.out',
            overwrite: 'auto'
        })
    }, { dependencies: [bootPhase] })

    useGSAP(() => {
        const titleCleanup = setupTextHover(titleRef.current, "title")
        const subtitleCleanup = setupTextHover(subtitleRef.current, "subtitle")

        return () => {
            titleCleanup()
            subtitleCleanup()
        }
    }, [])
    return (
        <section id="welcome">
            <p ref={titleRef}>
                {rendertext("Hey, I'm Debaditya! Welcome to my", "text-3xl font-georama", 100)}
            </p>
            <div ref={subtitleRef}>
                {rendertext("portfolio", "text-9xl italic font-georama")}
            </div>

            <div className='small-screen'>
                <p>This Portfolio is designed only for desktops/tablet screens.</p>
            </div>
        </section>
    )
}

export default Welcome