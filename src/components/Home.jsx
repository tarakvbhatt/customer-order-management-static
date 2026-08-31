import React from "react";
import { Link } from "react-router-dom";
import { Flame } from "lucide-react";

export default function Home() {
  return (
    <div className="mp-home">
      <div className="mp-home-hero">
        <p className="mp-home-eyebrow">
          <Flame size={14} /> Authentic Maharashtrian food
        </p>
        <h1>मु.पो.महाराष्ट्र</h1>
        <p className="mp-home-sub">
          Thalipeeth, misal pav, vada pav and more — made fresh, served straight from Bhayli, Vadodara.
        </p>
        <Link to="/order" className="mp-home-cta">Order Now</Link>
      </div>
    </div>
  );
}
