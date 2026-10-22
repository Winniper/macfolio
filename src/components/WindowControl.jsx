import { Minus, Plus, X } from 'lucide-react';

import useWindowStore from '../store/window';

const WindowControls = ({ target }) => {
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);

  return (
    <div id="window-controls">
      <button type="button" className="close" aria-label="Close" onClick={() => closeWindow(target)}>
        <X />
      </button>
      <button type="button" className="minimize" aria-label="Minimize" onClick={() => minimizeWindow(target)}>
        <Minus />
      </button>
      <button type="button" className="maximize" aria-label="Zoom" onClick={() => toggleMaximize(target)}>
        <Plus />
      </button>
    </div>
  );
};

export default WindowControls;
