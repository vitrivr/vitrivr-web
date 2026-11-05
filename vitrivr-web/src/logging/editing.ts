/** An editing period starts with an actual edit and ends on blur or submission. */
export class EditingPeriods {
    private active = new WeakSet<object>();

    start(field: object): boolean {
        if (this.active.has(field)) return false;
        this.active.add(field);
        return true;
    }

    end(field: object) { this.active.delete(field); }
    reset() { this.active = new WeakSet<object>(); }
}

export const editingPeriods = new EditingPeriods();
