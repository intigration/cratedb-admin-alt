import {defineStore} from "pinia";
import {reactive, toRefs, watch} from "vue";

import {request_crate} from "@/store/http/requests";
import queries from "@/store/http/queries";
import {Schemas} from "@/store/crate_api/tables";
import {Columns} from "@/store/crate_api/columns";
import {use_global_store} from "@/store/global_store";
import {use_log_store} from "@/store/log";

export const use_tables_store = defineStore('tables', () => {
    const state = reactive({
        schemas: new Schemas([]),
        current_tab: '',
        current_open_table: null,
        current_open_schema: null, // We only need this to have a Schema reference.
        current_open_table_columns: null,
        current_show_create_table: null,
        sample_data: null
    })
    const log_store = use_log_store()
    const global_store = use_global_store()

    async function update_tables() {
        const _response = await request_crate(queries.TABLES)
        const tables = await _response.json()
        state.schemas = new Schemas(tables.rows)
    }

    async function update_table_columns_information(table_name, table_schema) {
        // Gets the columns for the current open table.
        const _response = await request_crate(queries.COLUMNS, null, {
            '%table_name': table_name,
            '%table_schema': table_schema
        })
        const columns = await _response.json()
        state.current_open_table_columns = new Columns(columns.rows)
    }

    async function update_table_sample_data() {
        const _response = await request_crate(queries.SAMPLE_DATA, null, {
            '%table_name': state.current_open_table.name,
            '%table_schema': state.current_open_table.schema
        })
        const data = await _response.json()
        state.sample_data = data
    }

    async function drop_table() {
        const _response = await request_crate(queries.DROP_TABLE,
            null,
            {
                '%schema_name': state.current_open_table.schema,
                '%table_name': state.current_open_table.name
            })

        if (_response.ok) {
            const _table_fqd = state.current_open_table.schema + '.' + state.current_open_table.name

            await update_tables()
            // TODO
            // Perhaps we can locally delete the data instead of forcing a request + re-drawn.
            // this costs a few milliseconds delay when deleting a table, it is not a 'problem'
            // but it is noticeable, should be fixed to ensure max smoothness.
            // We do it correctly in drop user and table privileges for reference.

            global_store.show_successful_snackbar(`Table ${_table_fqd} deleted correctly`)
            state.current_open_table = null // Redraws the card, in this case, removing it.
            await log_store.log(log_store.ACTIONS.DROP_TABLE, _table_fqd)
        } else {
            global_store.show_error_snackbar(`Something went wrong`)
        }
    }

    async function create_table(sql) {
        // In this particular case, the sql is generated by the UI in Tables.vue
        const _response = await request_crate(sql)

        if (_response.ok) {
            global_store.show_successful_snackbar('Table created')
        } else {
            global_store.show_error_snackbar('Something went wrong')
        }
    }

    async function show_create_table(table_name) {
        const response = await request_crate(
            queries.SHOW_CREATE,
            null,
            {'%table_name': table_name}
        )
        const data = await response.json()
        state.current_show_create_table = data.rows[0][0]
    }

    watch(
        () => state.current_open_table, async (value) => {
            if (value == null) {
                // We check for null because this could get triggered in situations where for example:
                // state.current_open_table is 'doc.table_test', we DROP the table, we set
                // state.current_open_table to null, resetting the entire view, closing the table card
                // and updating the left drawer, in that situation, we do not want this to be called
                // since there is no table to get the columns for, nor the need.
                return
            }
            await update_table_columns_information(value.name, value.schema)

            // If we change from one table to another, reset the tab position, this is intended
            // to avoid unnecessary calls, for example if the user is in 'doc.table' and has
            // the sample_table tab selected, if he changes to another table, it is preferable
            // not to open the table in the same tab, but reset it to the column's, if the
            // user wants again sample_table, for example, he will have to click once again.
            state.sample_data = null
            state.current_tab = 'one'
        }
    )
    return {
        ...toRefs(state),
        create_table,
        update_tables,
        update_table_sample_data,
        drop_table,
        show_create_table
    }
})
