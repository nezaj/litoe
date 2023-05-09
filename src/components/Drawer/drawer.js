import React, { useState } from "react";
import { CSSTransition } from "react-transition-group";
import "./drawer.css";

const Drawer = ({ defaultOpen, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="z-40">
      <button
        onClick={toggleDrawer}
        className="py-2 px-4 absolute top-0 right-0 z-50"
      >
        {isOpen ? "-" : "+"}
      </button>
      <CSSTransition
        in={isOpen}
        timeout={300}
        classNames="drawer"
        unmountOnExit
      >
        <div className="drawer absolute top-0 right-0 h-screen w-64 overflow-auto transform translate-x-0 transition-transform duration-300 ease-in-out bg-slate-200 bg-opacity-60">
          {children}
        </div>
      </CSSTransition>
    </div>
  );
};

export default Drawer;
