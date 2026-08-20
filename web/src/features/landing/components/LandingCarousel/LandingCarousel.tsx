import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  coverflowPlacement,
  firstActiveIndex,
  lastActiveIndex,
} from "../../lib/coverflowPlacement";
import { carouselSlides } from "./carouselSlides";
import "./LandingCarousel.css";

const finalActiveIndex = lastActiveIndex(carouselSlides.length);

export const LandingCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(firstActiveIndex);
  // Updating from the previous value, not the rendered one, so two quick clicks
  // move two cards rather than one.
  const showPrevious = () => {
    setActiveIndex(current => Math.max(firstActiveIndex, current - 1));
  };
  const showNext = () => {
    setActiveIndex(current => Math.min(finalActiveIndex, current + 1));
  };

  return <section className="landing-carousel">
    <div className="landing-carousel__inner">
      <div className="landing-carousel__heading">
        <p className="landing-carousel__eyebrow">A look around</p>
        <h2>See it before you sign up.</h2>
      </div>
      <div className="landing-carousel__stage">
        <div className="landing-carousel__controls">
          <button
            aria-label="Show the previous screen"
            className="landing-carousel__arrow"
            disabled={activeIndex === firstActiveIndex}
            onClick={showPrevious}
            type="button"
          ><ChevronLeft aria-hidden="true" size={20} /></button>
          <button
            aria-label="Show the next screen"
            className="landing-carousel__arrow"
            disabled={activeIndex === finalActiveIndex}
            onClick={showNext}
            type="button"
          ><ChevronRight aria-hidden="true" size={20} /></button>
        </div>
        {carouselSlides.map((slide, index) => <figure
          className="landing-carousel__card"
          data-placement={coverflowPlacement(index, activeIndex)}
          key={slide.title}
        >
          <span className="landing-carousel__frame">
            <img alt={slide.alt} src={slide.image} />
          </span>
          <figcaption className="landing-carousel__caption">
            <strong>{slide.title}</strong>
            <span>{slide.line}</span>
          </figcaption>
        </figure>)}
      </div>
    </div>
  </section>;
};
