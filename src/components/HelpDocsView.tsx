export function HelpDocsView() {
  const sections = [
    {
      title: '01. Applications & Dynamic Forms',
      body: 'Every project in Structura acts as an independent application containing one or more custom forms, auto-synced database tables, and structured records. Use "Create Application" or start immediately from 15 ready-made templates.',
    },
    {
      title: '02. Drag-and-Drop Visual Form Builder',
      body: 'Drag any of the 26 field types from the Field Library onto the Form Canvas, or click a field to append it. Rearrange fields, span across 1, 2, or 3 columns, enable Multi-Step mode, and customize validation rules or theme presets with instant live preview.',
    },
    {
      title: '03. Conditional Logic Engine',
      body: 'In the Right Panel under "Logic & Advanced", define Conditional Visibility or Conditional Required rules using AND/OR combinators and 8 operators (Equals, Not Equals, Contains, Greater Than, Less Than, Is Empty, etc.). For example: IF Gender = Male THEN Show Father\'s Name.',
    },
    {
      title: '04. Database Manager & Relationships',
      body: 'Saving a form automatically synchronizes its linked table schema. Inside Database Manager, you can also create custom tables, designate Primary Keys, enforce Unique constraints, and link tables via One-to-One, One-to-Many, or Many-to-Many relationships.',
    },
    {
      title: '05. Publishing & Standalone Application URLs',
      body: 'Open Publish Settings on any application to select Private, Internal Team, Public Form, Password-Protected Form, or Authenticated access. Public and password-protected forms generate a standalone route at /apps/<your-slug> that renders the published snapshot.',
    },
    {
      title: '06. Bangla (বাংলা) & Unicode Data Support',
      body: 'Switch the workspace between English and বাংলা from the top navigation bar or Settings. Form labels, records, searches, CSV (UTF-8 BOM), Excel (XLSX), and Printable HTML exports fully preserve Bangla Unicode characters.',
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Help & Documentation
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Architecture guide for designing, validating, publishing, and managing data entry applications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sections.map((sec) => (
          <div
            key={sec.title}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5"
          >
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {sec.title}
            </h2>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {sec.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
