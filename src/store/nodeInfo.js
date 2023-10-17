// Store that keeps the node info from CrateDB instances.
import {defineStore} from "pinia";
import {reactive, toRefs} from "vue";

import {requestCrate} from "@/store/http/requests";
import queries from "@/store/http/queries";
import {CrateNodes} from "@/store/crate_api/node";
import {CrateTableHealths} from "@/store/crate_api/health";
import {AllocationIssues} from "@/store/crate_api/allocations";
import {NodeChecks} from "@/store/crate_api/node_checks";
import {Jobs} from "@/store/crate_api/jobs";

const REFRESH_EVERY_MS = 5000 // milliseconds

// We need the emptyNodeResult as a 'default' value when the initial requests to populate data
// hasn't yet been completed, will usually only be on screen for .1-.2 seconds.
// Ideally we would have some 'loading' https://vuetifyjs.com/en/components/skeleton-loaders/
// or some initial general loading screen (since it'd only appear for .1s-.2s it'd be fine)
// But honestly, it's way easier to just create an empty json, the return for the effort is
// the most optimal FOR NOW.
const emptyNodeResult = [
  "load",
  {
    "1": 'load',
    "15": 'load',
    "5": 'load',
    "probe_timestamp": 'load'
  },
  {
    "disks": [{
      "available": 0,
      "used": 0,
      "dev": "load",
      "size": 0
    }],
    "data": [{"dev": "load", "path": "load"}],
    "total": {
      "bytes_written": 0,
      "size": 0,
      "available": 0,
      "reads": 0,
      "bytes_read": 0,
      "used": 0,
      "writes": 0
    }
  },
  {
    "used": 0,
    "free": 0,
    "max": 0,
    "probe_timestamp": 0
  },
  "load",
  {version: "version"}, // version
  {} // os info
]
export const useNodeInfoStore = defineStore('nodeInfo', () => {
  const state = reactive({
    nodes: new CrateNodes([emptyNodeResult,], 1),
    health: new CrateTableHealths([]),
    allocations: new AllocationIssues([]),
    node_checks: new NodeChecks([]),
    jobs: new Jobs([]),
    shouldUpdateAllocation: false,
    nodeCount: '0'
  })

  async function updateNodeInfo() {
    const _response = await requestCrate(queries.NODE_INFO)
    const nodeInfo = await _response.json()
    state.nodes = new CrateNodes(nodeInfo.rows, nodeInfo.rowcount)
  }

  async function updateHealthInfo() {
    const _response = await requestCrate(queries.HEALTH)
    const healthInfo = await _response.json()
    state.health = new CrateTableHealths(healthInfo.rows)

    // If there is a bad health table, we start fetching allocation issues, otherwise
    // we can stop fetching it.
    state.shouldUpdateAllocation = !!state.health.hasBadHealth();
  }

  async function updateAllocationIssuesInfo() {
    const _response = await requestCrate(queries.ALLOCATIONS)
    const allocationInfo = await _response.json()
    state.allocations = new AllocationIssues(allocationInfo.rows)
  }

  async function updateNodeChecks() {
    const _response = await requestCrate(queries.NODE_CHECKS)
    const nodeChecksInfo = await _response.json()
    state.node_checks = new NodeChecks(nodeChecksInfo.rows)
  }

  async function updateJobsInfo() {
    const _response = await requestCrate(queries.JOBS)
    const jobs_info = await _response.json()
    state.jobs = new Jobs(jobs_info.rows)
  }
  // We update them synchronously the first time we launch the site
  //
  // What happens if for some reason one fails and the others don't ?
  updateNodeInfo()
  updateHealthInfo()
  updateNodeChecks()
  updateJobsInfo()

  setInterval(async () => {
    await Promise.allSettled([
        updateNodeInfo(),
        updateHealthInfo(),
        updateNodeChecks(),
        updateJobsInfo(),
      ]
    )

    if (state.shouldUpdateAllocation) {
      await updateAllocationIssuesInfo()
    }
  }, REFRESH_EVERY_MS);

  return {
    ...toRefs(state),
  }
})
