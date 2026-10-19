# Migrating from mrcatz/datatable (Laravel)

Every Laravel method, property and config key mapped to its JavaScript name. The naming was tidied up to stay consistent:
**nouns** for definitions (`col.*`, `field.*`, `filter.*`), **descriptive props / options** for behaviour, and
**`on*` handlers / events** for user actions.

For full examples of each item, open the matching page on [datatable.catzoid.tech](https://datatable.catzoid.tech/?stack=js) —
every page shows the Laravel and the JavaScript code side by side.

## Table & columns

| Laravel (`MrCatzDataTables` / `MrCatzDataTablesComponent`) | JS |
|---|---|
| `MrCatzDataTablesComponent` (table class) | `defineDataTable()` (server) + `<MrcDataTable>` (client) |
| `baseQuery()` | `baseWhere` |
| `configTable()` → `table_name`, `table_id` | `search.relevance.table`, `primaryKey` |
| `configTable()` → `scoring` | `search.columns[].weight` |
| `configTable()` → `typo_tolerance` | `search.typoTolerance` |
| `configTable()` → `scoring` on joined columns (`customers.name`) | `search.relevance.joins` + `column: 'alias.column'` |
| `search.driver = 'scout'` + `scout_model` | `search.driver: meilisearchDriver({ client, index })` (`@mrcatz/datatable-server/meilisearch`) |
| `scout_max_results`, `filter_pushdown`, `date_field_map` | `maxResults`, `filterPushdown`, `dateFields` |
| `mrcatz:meilisearch:configure` | `syncMeilisearchSettings(table, client?, index?)` |
| `mrcatz:make-search-proxy` | not needed — your app indexes the documents (id = primary key) |
| `setTable()` + `CreateMrCatzTable()` | prop `columns` |
| `withColumn($head, $key, ...)` | `col.text(key, label, opts)` (+ `col.number`, `col.date`, `col.badge`) |
| `withCustomColumn($head, fn)` | `col.custom(label, render)` or the `#cell-{id}` slot |
| `withColumnIndex('No')` | `col.rowNumber()` |
| `withActionColumn($head, $editable, $deletable)` | `col.actions({ edit, delete, extra })` |
| `withColumnImage(...)` | `col.image(key, label, opts)` |
| `uppercase`, `th`, `gravity` | `uppercase`, `rowHeader`, `align` |
| `visible: false` | `hidden: true` |
| `setDefaultOrder()` / `addOrderBy()` | `defaultSort` / `tiebreaker` |
| `getRowPerPageOption()` / `$p` | `perPageOptions` / `defaultPerPage` |
| `setPageName()` / `urlPrefix()` | `name` / `urlPrefix` (client), `prefix` (server) |
| `setSearchWord()` | `highlight()` / `<MrcHighlight>` |
| `enableBulk(fn)` | prop `selectable` |
| `$showBulkButton` / `toggleBulk()` / `$bulkActive` | prop `selection-toggle` / "Select" button / `v-model:selection-mode` |
| `enableEditable(fn)` | `col.text(..., { editable: { when } })` |
| `enableExpand(fn)` + `getExpandView()` | prop `expandable` + `expandFields` / `#expand` slot, per row `expandWhen` |
| `getExpandView()` type `html` / `urlPrefix` / `target` | `ExpandField` `type: 'html' \| 'custom'`, `baseUrl`, `target` |
| `withColumn(..., editable:)` textarea / Tab | `editable: { input: 'textarea', saveOnBlur, parse }`, Tab = save & move to next cell |
| `$showSearch`, `$typeSearch`, `$typeSearchDelay` | `searchable`, `searchMode`, `searchDebounce` |
| `$showAddButton` | `creatable` (automatic when `@create` is set) |
| `$usePagination = false` + `$maxRows` | `pagination: 'load-more'` + `loadMoreChunk` |
| `$showLoadMoreButton` | `loadMoreButton` |
| `$withLoading` | `loadingOverlay: 'fullscreen'` |
| `$filterDebounceDelay` | `filterDebounce` (ms, default 300) |
| `onDataLoaded()` / `onFilterChanged()` | `@loaded(page)` / `@filter-change(id, value, filters)` |
| `$exportTitle`, `beforeExport()`, `afterExport()` | `:exportable="{ title, subtitle, filename, transform, onExported }"` |
| `config('mrcatz.export_colors')` | `createMrcatz({ export: { colors } })` / `exportable.colors` |
| `vendor:publish --tag=mrcatz-export` | `exportable.printTemplate` (PDF layout) + `buildExportTable`, `buildXlsx`, `downloadXlsx`, `printTable`, `escapeHtml` |
| `$cardContainer`, `$borderContainer` | `card`, `bordered` |
| `$tableZebraStyle`, `$stickyHeader` | `zebra`, `stickyHeader` |
| `$enableRowClick` / `onRowClick()` | `@row-click` |
| `$enableColumnVisibility` / `Reorder` / `Resize` / `Sorting` | `columnVisibility` / `columnReorder` / `columnResize` / `sorting` |
| `$enableKeyboardNav`, `$showKeyboardNavNote` | `keyboardNav`, `showKeyboardHint` |
| `$showCardOnMobile` | `mobileCards` |
| `refreshData()` / `refreshDataTable` event | `refresh()` |
| `resetData()` | `reset()` |
| `orderData()` / `addSort()` | `toggleSort(key, multi)` |
| `toggleColumn()` / `reorderColumn()` | `toggleColumn(id)` / `moveColumn(id, index)` |
| `emptyStateView()` | `#empty` slot |

## Filters

| Laravel (`MrCatzDataTableFilter`) | JS (`filter.*`) |
|---|---|
| `create($id, $label, $data, $value, $option, $key)` | `filter.select(id, label, { field, options })` |
| `createWithCallback(..., $callback)` | `filter.select(id, label, { options, where })` |
| `createCheck(...)` / `createCheckWithCallback` | `filter.multi(id, label, { field \| where, options })` |
| `->allowExclude()` | `allowExclude: true` |
| `->allowSearchWhen(5)` | `searchThreshold: 5` |
| `createDate(..., $format, $condition)` | `filter.date(id, label, { field, format, operator })` |
| `createDateRange(...)` | `filter.dateRange(id, label, { field, format })` |
| format `month_year` | format `month` |
| format `time` / `time_hm` | format `time` / `timeHm` (server: requires `where`; helpers `parseTimeOfDay`, `periodOf`) |
| `setFilterDateBounds($id, min, max, condition)` / `clearFilterOverride()` | `min`, `max`, `operator` as functions `(ctx) => ...` |
| `whereIn` / `whereNotIn` conditions | Include / Exclude mode (`exclude`) |
| `setFilterShow()` / `onFilterChanged()` | `visible: (ctx) => ...` + `dependsOn` |
| `setFilterData()` | `options: (ctx) => ...` (recomputed from `dependsOn`) |
| `$data`, `$value`, `$option` | `options: [{ value, label }]` |

## CRUD page & forms

| Laravel (`MrCatzComponent` / `MrCatzFormField`) | JS |
|---|---|
| `MrCatzComponent` (page) | `<MrcCrudTable>` |
| `setForm()` | prop `fields` |
| `prepareAddData()` | `defaultValues` |
| `prepareEditData($data)` | `toFormValues(row)` |
| `prepareDeleteData()` + `$deleted_text` | `deleteLabel(row)` |
| `saveData()` (`$isEdit`) | `create(values)` / `update(row, values)` |
| `dropData()` | `remove(row)` |
| `dropBulkData($rows)` | `removeMany(rows)` |
| `onInlineUpdate()` | `@cell-update(row, key, value)` |
| `setBulkAction()` + `MrCatzBulkAction::create()` | `bulkActions` + `bulkAction(id, label, opts)` |
| `processBulkActionData()` | `@bulk-action(action, rows, values)` |
| `dispatch_to_view()` / `show_notif()` | automatic (toast + refresh) / `notify`; bulk actions: `bulkAction({ notify })` |
| `setBulkForm()` returning a Blade section | `field.slot('x')` + `#bulk-field-{actionId}-x` slot |
| `$form_title` | `formTitle(mode, row)` |
| `$modalFullScreen` / `closeFormPage()` | `form-page` (form replaces the table) / `closeForm()` |
| `$formPageCard` / `$formPageBorder` | `form-page-card` / `form-page-border` |
| `$deleteModalDismissOnClickOutside` | `delete-dismissible` |
| `mrcatz-form-page-opened` / `-closed` events | `@form-open(mode, row)` / `@form-close(mode)` |
| `php artisan mrcatz:make` / `mrcatz:remove` | `npx mrcatz make` / `npx mrcatz remove` |
| `processEditorImages()` + `EditorImageUploadController` + `mrcatz:cleanup-editor-images` | `editorImages({ storage }).processHtml()` / `.upload()` / `.cleanupTmp()` |
| `config('mrcatz.locale')` / per page | `createMrcatz({ locale })`, `useMrcatz().setLocale()`, `<MrcConfigProvider>` |
| `MrCatzFormField::text(...)` etc. | `field.text(name, label, opts)` etc. |
| `->span(6)`, `->hint()`, `->prefix()`, `->suffix()` | `span: 6`, `hint`, `prefix`, `suffix` |
| `->visibleWhen()` / `->visibleWhenAll()` / `->hideWhen()` | `visibleWhen: { field: value }` or a function / `hidden` |
| `->dependsOn()` / `->onChange()` | `dependsOn: [...]` / `onChange(value, values)` |
| `->withConfirmation()` | `confirm: true` |
| `->withoutShowHide()` / `->withoutGenerate()` | `reveal: false` / `generate: false` |
| `MrCatzFormField::section()->asCard()` | `field.section(title, { card: true })` |
| `MrCatzFormField::button(..., onClick:)->withLoading()` | `field.button(label, { icon, tone, onClick: async (ctx) => ... })` |
| `MrCatzFormField::image()->preview()->onUpload()->onDelete()` | `field.image(name, label, { preview, onUpload, onDelete, deleteConfirm })` |
| `->hint($text, 'success')` | `hint`, `hintTone: 'success'` |
| `MrCatzFormField::file()` / `fileupload()` + `->preview($url, w, h)` | `field.file()` / `field.fileUpload()` + `preview`, `previewWidth`, `previewHeight`, `onUpload`, `onDelete` |
| `MrCatzFormField::dateRange(..., 'month_year')` | `field.dateRange(name, label, { format: 'month' })` |
| `MrCatzFormField::rating()` / `chooser()` / `html()` | `field.rating()` / `field.chooser()` / `field.html()` |
| `MrCatzFormField::editor()` / `editorAdvance()` | `field.editor()` / `field.editorAdvanced()` + entries `/editor`, `/editor-advanced` |
| `->uploadPath()` + `config('mrcatz.editor_image')` | `upload: (file) => Promise<url>` (omitted = base64) |
| `MrCatzFormField::mapPicker(..., showRadius:)` | `field.map(name, label, { provider, apiKey, center, zoom, radius, height, theme })` + entry `/map` |
| `->style('primary')` / `->size('sm')` | `tone: 'primary'` / `size: 'sm'` |
| `->margin()` / `->padding()` | `class: 'mt-4 px-2'` |
| `->debounce(500)` | `onChangeDebounce: 500` |
| `$messages` | `messages: { required: '...', min: '...' }` |
| `$formGap` / `$formColumnGap` | `gap` / `column-gap` (`form-gap` / `form-column-gap` on `<MrcCrudTable>`) |
| `form-standalone` `submitStyle` | `<MrcFormPage submit-tone="success">` |
| `@section('forms')` (without `setForm()`) | slot `#form="{ values, errors, set, mode, row, submit }"` on `<MrcCrudTable>` |
| `->rowSpan(4)` / `->mobileOrder(-1)` | `rowSpan: 4` / `mobileOrder: -1` |
| `form-standalone.blade.php` | `<MrcFormPage :submit="..." button-card />` |
| `breadcrumbs.blade.php` + `$breadcrumbs` | `<MrcBreadcrumbs :items="[{ title, to }]" />` |
| `mrcatz_icon('name')` (Material) | `<MrcIcon name="name" />` — built-in SVG icons, any other name renders as Material Symbols |
| `config('mrcatz.icon_set')`, `custom_icons`, `form_icons` | `createMrcatz({ icons: { set, custom } })` |
| `rules: 'required\|min:8'` | `required`, `minLength`, `validate`, or `schema` (zod / valibot) |
| `MrCatzEvent::*` (Livewire events) | plain props / handlers — no global event bus |

> A complete example app (NestJS + Nuxt, the equivalent of `mrcatz-laravel-template`): **mrcatz-js-template**.
