// Store for Global state.

import {defineStore} from 'pinia'
import {reactive, toRefs} from 'vue';

export const use_global_store = defineStore('settings', () => {
    const state = reactive({
        settings_drawer_toggle: false,
        show_network_connection_snackbar: false,
        network_connection_attemps: 1,

        // Snackbar for all other custom notifications
        show_snackbar: false,
        snackbar_opts: {
            title: '',
            message: '',
            color: '',
            duration_ms: 2000,
            icon: 'mdi-tick'
        }
    })

    function show_successful_snackbar(message) {
        state.snackbar_opts = {
            title: 'Success',
            message: message,
            color: 'success',
            icon: 'mdi-check',
        }
        state.show_snackbar = true
    }

    function show_error_snackbar(message) {
        state.snackbar_opts = {
            title: 'Error',
            message: message,
            color: 'error',
            icon: 'mdi-alert',
        }
        state.show_snackbar = true
    }

    return {
        ...toRefs(state),
        show_successful_snackbar,
        show_error_snackbar
    }
})
