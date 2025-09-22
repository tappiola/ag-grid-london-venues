import type {
  FilterDisplay,
  FilterDisplayParams,
  IAfterGuiAttachedParams,
  IRowNode,
  ValueGetterParams,
} from "ag-grid-community";

export class SetFilter implements FilterDisplay<unknown, unknown, string[]> {
  gui!: HTMLDivElement;
  eFilterText!: HTMLInputElement;
  private listEl!: HTMLDivElement;
  private selectAllEl!: HTMLInputElement;

  private selected = new Set<string>();
  private detachModelUpdated?: () => void;

  init(params: FilterDisplayParams<unknown, unknown, string[]>) {
    this.gui = document.createElement("div");
    this.gui.innerHTML = `<div class="ag-filter-body-wrapper ag-simple-filter-body-wrapper ag-focus-managed">
      <div>
        <input type="text" id="filterText" placeholder="Search..." class="ag-input-field-input ag-text-field-input" />
      </div>

      <div style="margin:8px 0;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="selectAll" />
          <span>(Select All)</span>
        </label>
      </div>

      <div id="valuesList" style="max-height:280px;overflow:auto;"></div>
    </div>`;

    this.eFilterText = this.gui.querySelector<HTMLInputElement>("#filterText")!;
    this.listEl = this.gui.querySelector<HTMLDivElement>("#valuesList")!;
    this.selectAllEl = this.gui.querySelector<HTMLInputElement>("#selectAll")!;

    type UnknownRecord = Record<string, unknown>;

    const getByPath = (obj: unknown, path?: string): unknown => {
      if (!path) return undefined;
      const segments = path.split(".");
      let cur: unknown = obj;
      for (const seg of segments) {
        if (typeof cur !== "object" || cur === null) return undefined;
        const rec = cur as UnknownRecord;
        if (!Object.prototype.hasOwnProperty.call(rec, seg)) return undefined;
        cur = rec[seg];
      }
      return cur;
    };

    const extractFixedValues = (): string[] | undefined => {
      const v =
        (params as { filterParams?: { values?: unknown } }).filterParams
          ?.values ??
        (params.colDef as { filter?: { filterParams?: { values?: unknown } } })
          .filter?.filterParams?.values;

      return Array.isArray(v) ? v.map(String) : undefined;
    };

    const fixedValues: string[] | undefined = extractFixedValues();

    const readCell = (node: IRowNode<unknown>): unknown => {
      const colId = params.column.getColId();

      type ApiWithGet = typeof params.api & {
        getCellValue?: (p: {
          rowNode: IRowNode<unknown>;
          colKey: string;
        }) => unknown;
      };
      const apiWithGet = params.api as ApiWithGet;

      if (typeof apiWithGet.getCellValue === "function") {
        return apiWithGet.getCellValue({ rowNode: node, colKey: colId });
      }

      const vg = params.colDef.valueGetter;

      if (typeof vg === "function") {
        const vgParams: ValueGetterParams = {
          api: params.api,
          column: params.column,
          colDef: params.colDef,
          context: params.context,
          data: node.data,
          node,
          getValue: (field: string) => getByPath(node.data, field),
        };
        return vg(vgParams);
      }

      return getByPath(node.data, params.colDef.field);
    };

    const collectUniverse = (): string[] => {
      if (fixedValues) {
        return [...new Set(fixedValues)].sort((a, b) => a.localeCompare(b));
      }
      const set = new Set<string>();
      params.api.forEachNode((node: IRowNode<unknown>) => {
        if (!node.data) return;
        const raw = readCell(node);
        if (Array.isArray(raw)) {
          for (const v of raw) set.add(String(v ?? ""));
        } else {
          set.add(String(raw ?? ""));
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    const collectAvailable = (): string[] => {
      const set = new Set<string>();
      const colId = params.column.getColId();
      const model = params.api.getFilterModel() as Record<string, unknown>;

      const universe = collectUniverse();

      params.api.forEachNodeAfterFilter((node: IRowNode<unknown>) => {
        if (!node.data) return;
        const raw = readCell(node);
        if (Array.isArray(raw)) {
          for (const v of raw) set.add(String(v ?? ""));
        } else {
          set.add(String(raw ?? ""));
        }
      });

      if (Object.prototype.hasOwnProperty.call(model, colId)) {
        return [...universe].sort((a, b) => a.localeCompare(b));
      }

      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    let values = collectAvailable();
    let availableSet = collectAvailable();

    if (Array.isArray(params.model)) {
      this.selected = new Set(params.model.map(String));
    } else {
      this.selected = new Set(values);
    }

    const emit = () => {
      const total = values.length;
      const sel = this.selected.size;

      if (sel === total) {
        params.onModelChange(null);
      } else {
        const ordered = values.filter((v) => this.selected.has(v));
        params.onModelChange(ordered);
      }
    };

    const updateSelectAllState = () => {
      const total = values.length;
      const sel = this.selected.size;
      this.selectAllEl.checked = total > 0 && sel === total;
      this.selectAllEl.indeterminate = sel > 0 && sel < total;
    };

    const render = () => {
      const q = this.eFilterText.value.trim().toLowerCase();
      this.listEl.innerHTML = "";

      const filtered = availableSet.filter((v) => v.toLowerCase().includes(q));

      for (const v of filtered) {
        const id = `pf_${params.column.getColId()}_${btoa(v).replace(/=+/g, "")}`;
        const isAvailable = availableSet.includes(v);

        const label = document.createElement("label");
        label.htmlFor = id;
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "8px";
        label.style.marginBottom = "6px";
        if (!isAvailable) label.style.opacity = "0.6";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = id;
        cb.value = v;
        cb.checked = this.selected.has(v);
        cb.addEventListener("change", (e) => {
          const input = e.currentTarget as HTMLInputElement;
          if (input.checked) {
            this.selected.add(v);
          } else {
            this.selected.delete(v);
          }
          emit();
          updateSelectAllState();
        });

        const text = document.createElement("span");
        text.textContent = v;

        label.append(cb, text);
        this.listEl.appendChild(label);
      }

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.style.opacity = "0.7";
        empty.style.fontStyle = "italic";
        empty.textContent = "No values";
        this.listEl.appendChild(empty);
      }

      updateSelectAllState();
    };

    // Search input filters the visible list only
    this.eFilterText.addEventListener("input", render);

    // Select All toggles the entire universe (not just visible)
    this.selectAllEl.addEventListener("change", () => {
      if (this.selectAllEl.checked) {
        this.selected = new Set(values);
      } else {
        this.selected.clear();
      }
      render();
      emit();
    });

    const onModelUpdated = () => {
      if (!fixedValues) {
        values = collectAvailable();
      }
      availableSet = collectAvailable();

      const nextSelection = new Set<string>();
      this.selected.forEach((v) => {
        if (values.includes(v)) {
          nextSelection.add(v);
        }
      });

      this.selected = nextSelection;
      render();
    };

    params.api.addEventListener("modelUpdated", onModelUpdated);
    this.detachModelUpdated = () =>
      params.api.removeEventListener("modelUpdated", onModelUpdated);

    render();
  }

  refresh(): boolean {
    return true;
  }

  getGui() {
    return this.gui;
  }

  afterGuiAttached(params?: IAfterGuiAttachedParams): void {
    if (!params?.suppressFocus) {
      this.eFilterText.focus();
    }
  }

  destroy(): void {
    this.detachModelUpdated?.();
  }
}

export default SetFilter;
