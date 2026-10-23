import useSystemStore from '../../store/system';

// Control Center's Display slider: a black overlay that ignores the pointer.
const DisplayDimmer = () => {
    const brightness = useSystemStore((state) => state.brightness);

    if (brightness >= 1) return null;
    return <div className="display-dimmer" style={{ opacity: 1 - brightness }} aria-hidden="true" />;
};

export default DisplayDimmer;
