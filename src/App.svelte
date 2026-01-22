<script lang="ts">
  import OSSM from "./OSSM.svelte";
  let ossmComponent: any;
  let ossmDevices = $state([]); // List of OSSM devices
  const bt = (navigator as any).bluetooth; 

</script>
<div
  class="mainContainer"
  role="none"
>
  <div style="position: relative; padding: 0; width: 100%; max-width: 100%; box-sizing: border-box; display: flex; justify-content: center; align-items: center; flex-direction: column; overflow-x: hidden;">
    <div style="display: flex; justify-content: space-between; width: 100%; max-width: 100%; box-sizing: border-box; padding: 4px; flex-wrap: wrap; gap: 0.5rem;">

  
      <OSSM bind:this={ossmComponent} bind:devices={ossmDevices} />
    </div>
  </div>
</div>  