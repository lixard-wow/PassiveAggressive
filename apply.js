    const specsByClass = {
      'Death Knight':  ['Blood', 'Frost', 'Unholy'],
      'Demon Hunter':  ['Havoc', 'Vengeance'],
      'Druid':         ['Balance', 'Feral', 'Guardian', 'Restoration'],
      'Evoker':        ['Augmentation', 'Devastation', 'Preservation'],
      'Hunter':        ['Beast Mastery', 'Marksmanship', 'Survival'],
      'Mage':          ['Arcane', 'Fire', 'Frost'],
      'Monk':          ['Brewmaster', 'Mistweaver', 'Windwalker'],
      'Paladin':       ['Holy', 'Protection', 'Retribution'],
      'Priest':        ['Discipline', 'Holy', 'Shadow'],
      'Rogue':         ['Assassination', 'Outlaw', 'Subtlety'],
      'Shaman':        ['Elemental', 'Enhancement', 'Restoration'],
      'Warlock':       ['Affliction', 'Demonology', 'Destruction'],
      'Warrior':       ['Arms', 'Fury', 'Protection'],
    };


    document.getElementById('charClass').addEventListener('change', function () {
      const specSelect = document.getElementById('charSpec');
      const specs = specsByClass[this.value] || [];
      specSelect.innerHTML = specs.length
        ? `<option value="">Select a spec</option>` + specs.map(s => `<option>${s}</option>`).join('')
        : '<option value="">Select a class first</option>';
    });

    document.getElementById('applyForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const form = document.getElementById('applyForm');
      const button = document.getElementById('applySubmit');
      const status = document.getElementById('applyStatus');
      if (button.disabled) return;
      if (!form.reportValidity()) return;
      button.disabled = true;
      button.textContent = 'Submitting…';
      form.setAttribute('aria-busy', 'true');
      status.hidden = true;

      const charName   = document.getElementById('charName').value;
      const realm      = document.getElementById('realm').value;
      const charClass  = document.getElementById('charClass').value;
      const charSpec   = document.getElementById('charSpec').value;
      const role       = document.getElementById('role').value;
      const playerType = document.getElementById('playerType').value;
      const experience = document.getElementById('experience').value;
      const about      = document.getElementById('about').value;
      const discord    = document.getElementById('discord').value;
      const battletag  = document.getElementById('battletag').value;

      const realmSlug = realm.replace(/\s+/g, '').replace(/'/g, '');
      const playerTag = `${charName}-${realmSlug}`;

      const payload = {
        website: document.getElementById('website').value,
        rulesAgree: document.getElementById('rulesAgree').checked,
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `New Application — ${playerTag}`,
          color: 0xC8A96E,
          fields: [
            { name: 'Character',    value: `\`${playerTag}\``, inline: true },
            { name: 'Class',        value: charClass,  inline: true },
            { name: 'Spec',         value: charSpec,   inline: true },
            { name: 'Role',         value: role,       inline: true },
            { name: 'Player Type',  value: playerType, inline: true },
            { name: 'Discord',      value: discord,    inline: true },
            { name: 'BattleTag',    value: `\`${battletag}\``, inline: true },
            { name: 'M+ Experience', value: experience },
            { name: 'About',         value: about },
          ],
          timestamp: new Date().toISOString(),
        }]
      };

      const WORKER_URL = 'https://pa-proxy.pnutjr-lw.workers.dev';
      try {
        const response = await fetch(`${WORKER_URL}/apply`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
          if (response.status === 429) throw new Error('Too many attempts. Please wait a minute before trying again.');
          if (response.status === 400 || response.status === 413) throw new Error('Please check your entries and keep each answer under 1,000 characters.');
          throw new Error('We could not send your application. Your answers are still here. Try again or contact an officer in Discord.');
        }
        const result = await response.json();
        if (result.ok !== true) throw new Error('We could not confirm receipt. Please check with an officer in Discord before resubmitting.');
        form.style.display = 'none';
        const success = document.getElementById('applySuccess');
        success.classList.add('show');
        success.focus();
        success.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      } catch (error) {
        status.textContent = error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'The request timed out. It may have reached us; please check with an officer in Discord before resubmitting. Your answers are still here.'
          : error instanceof TypeError
            ? 'We could not confirm delivery. Your answers are still here. Check your connection or contact an officer in Discord before resubmitting.'
            : error.message;
        status.hidden = false;
      } finally {
        button.disabled = false;
        button.textContent = 'Submit Application';
        form.removeAttribute('aria-busy');
      }
    });
