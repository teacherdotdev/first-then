<script lang="ts">
  import InfoPage from "#lib/components/InfoPage.svelte";

  const link = "font-semibold text-accent-dark underline underline-offset-2";
</script>

<InfoPage title="Privacy" lede="What we collect, what we don't, and why.">
  <section
    class="flex flex-col gap-3 rounded-2xl bg-white p-5 leading-relaxed text-slate-700 shadow-sm"
  >
    <p>
      First / Then has no accounts and collects no personal information from
      teachers or students. It has no ads and sets no cookies.
    </p>
    <p>
      We use Cloudflare Web Analytics to anonymously count the number of visits,
      which helps us understand how First / Then is being used in classrooms.
      Cloudflare Web Analytics is cookieless, does not fingerprint visitors, and
      does not track users across other sites; see Cloudflare's
      <a
        class={link}
        href="https://www.cloudflare.com/privacypolicy/"
        target="_blank"
        rel="noopener">privacy policy</a
      > for details. We do not share, sell, or otherwise transfer any visitor data
      to third parties.
    </p>
    <p>
      Your board, favorites, recent symbols and settings are kept in this
      browser's local storage, and photos you add are stored in the browser's
      own database on this device. None of it is uploaded: First / Then has no
      server to send it to. A backup .zip is made on the device and goes only
      where you save or share it.
    </p>
    <p>
      When you search for a symbol, the words you type are sent to
      <a class={link} href="https://arasaac.org" target="_blank" rel="noopener"
        >ARASAAC</a
      >, and the symbol pictures are loaded from ARASAAC's servers, the way any
      website loads images. ARASAAC never receives your photos, your board or
      the words you label them with.
    </p>
    <p>
      Clearing this site's data in your browser erases everything First / Then
      has stored on this device.
    </p>
    <p>
      Questions or concerns? Email
      <a
        class={link}
        href="mailto:support@teacher.dev?subject=First%20%2F%20Then%20privacy"
        >support@teacher.dev</a
      >.
    </p>
  </section>
</InfoPage>
