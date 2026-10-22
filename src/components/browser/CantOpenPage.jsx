// Shown when address-bar text isn't a loadable web address.
const CantOpenPage = ({ input }) => (
    <div className="browser-page browser-cant-open">
        <h2 className="browser-page-title">Safari Can’t Open the Page</h2>
        <p>
            Safari can’t open “{input}” because it isn’t a valid web address.
        </p>
    </div>
);

export default CantOpenPage;
