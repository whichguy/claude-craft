import { onMount, onUnmount } from 'framework-lifecycle';

/**
 * TRAP: Classic SPA Memory Leak
 * 
 * A global event listener is added to the 'window' object when the
 * component mounts, but it is never detached when it unmounts.
 */
export class RealtimeDataWidget {
    constructor(elementId) {
        this.elementId = elementId;
        this.data = [];
    }

    handleGlobalEvent(event) {
        if (event.detail.type === 'DATA_SYNC') {
            this.data.push(event.detail.payload);
            console.log(`Widget ${this.elementId} synchronized.`);
        }
    }

    init() {
        onMount(() => {
            console.log(`Widget ${this.elementId} initialized.`);
            // The Trap: Adding a global listener...
            window.addEventListener('app-global-sync', this.handleGlobalEvent.bind(this));
        });

        onUnmount(() => {
            console.log(`Widget ${this.elementId} destroyed.`);
            this.data = null;
            // The Trap: ...but failing to remove it on unmount.
        });
    }
}
