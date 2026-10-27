/* LOVORA redesigned interaction layer. Demo-only social actions are clearly labeled; production needs secured backend endpoints. */
(()=>{
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const shell=$('.inboxShell'), sheet=$('#moreSheet');
 // Keep the legacy message view as an alias for the full-screen inbox/chat.
 const originalShow=window.showView;
 if(typeof originalShow==='function') window.showView=function(id){if(id==='messages')id='inbox';originalShow(id);document.body.classList.toggle('inbox-mode',id==='inbox');if(id==='inbox'){shell?.classList.remove('chat-open');document.body.classList.remove('chat-open-mode');if(typeof window.loadChats==='function')window.loadChats();}if(id==='communities'){renderJoined();loadRealCommunities();}if(id==='notifications')loadRealNotifications();if(id==='wallet')syncWallet();sheet?.classList.remove('show');};
 $$('[data-view]').forEach(b=>b.addEventListener('click',()=>{sheet?.classList.remove('show');if(b.dataset.view==='inbox'){setTimeout(()=>{if(typeof window.loadChats==='function')window.loadChats();},40)}}));
 $('#mobileMoreBtn')?.addEventListener('click',()=>{sheet.classList.toggle('show');$('#mobileMoreBtn')?.setAttribute('aria-expanded',sheet.classList.contains('show')?'true':'false')});$('#moreSheetClose')?.addEventListener('click',()=>{sheet.classList.remove('show');$('#mobileMoreBtn')?.setAttribute('aria-expanded','false')});
 // Light/dark theme preference persists locally and never touches Supabase data.
 const THEME_KEY='lovoraTheme_v1';function applyTheme(t){document.body.classList.toggle('light-theme',t==='light');const b=$('#themeToggle');if(b){b.textContent=t==='light'?'☾':'☼';b.setAttribute('aria-label',t==='light'?'Switch to dark theme':'Switch to light theme');b.title=t==='light'?'Switch to dark theme':'Switch to light theme';}}applyTheme(localStorage.getItem(THEME_KEY)||'dark');$('#themeToggle')?.addEventListener('click',()=>{const t=document.body.classList.contains('light-theme')?'dark':'light';localStorage.setItem(THEME_KEY,t);applyTheme(t)});
 $('#mobileLogout')?.addEventListener('click',()=>{sheet.classList.remove('show');$('#authButton')?.click()});$('#logoutSettings')?.addEventListener('click',()=>$('#authButton')?.click());
 $('#backToInbox')?.addEventListener('click',()=>{shell?.classList.remove('chat-open');document.body.classList.remove('chat-open-mode')});
 const syncInboxMode=()=>{document.body.classList.toggle('inbox-mode',document.querySelector('#inbox.view.active')!==null);};syncInboxMode();
 const demoChatData={amara:{name:'Amara',state:'● Online now',avatar:'avatarAmara',messages:[['Hey! How are you? 😊',false,'8:24 PM'],["I'm good! Just got back from work. How about you?",true,'8:26 PM　✓✓'],["I'm good too. What do you do for a living?",false,'8:29 PM'],["I'm a web developer. You?",true,'8:30 PM　✓✓'],['Would you like to grab coffee sometime?',false,'10:12 PM']]},chisom:{name:'Chisom',state:'● Active recently',avatar:'avatarChisom',messages:[['Hey, lovely to meet you here 😊',false,'Yesterday'],['Same here! What do you enjoy doing on weekends?',true,'Yesterday　✓✓'],['Usually music, good food and exploring new places.',false,'Yesterday']]},esther:{name:'Esther',state:'Last seen recently',avatar:'avatarEsther',messages:[['I sent you a voice note 🎙',false,'Monday']]}};
 function showDemoChat(key){const d=demoChatData[key]||demoChatData.amara;$('#chatPersonName').innerHTML=d.name+(key==='amara'?' <span class="verified blue">✓</span>':'');$('#chatPersonState').textContent=d.state;$('#chatAvatar').className='chatAvatar '+d.avatar;$('#chatAvatar').textContent=d.name[0];const dot=document.createElement('i');if(key!=='esther')$('#chatAvatar').append(dot);$('#chatList').innerHTML='<div class="dayDivider"><span>Today</span></div>'+d.messages.map(m=>`<p class="bubble ${m[1]?'mine':''}">${safe(m[0])}<small>${m[2]}</small></p>`).join('');$('#chatList').scrollTop=$('#chatList').scrollHeight;shell?.classList.add('chat-open');document.body.classList.add('inbox-mode','chat-open-mode');}
 function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 $$('[data-demo-chat]').forEach(b=>b.addEventListener('click',()=>{ $$('.inboxPerson').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');showDemoChat(b.dataset.demoChat)}));
 // Show a demo chat when a sample conversation is chosen; actual Supabase messages remain handled by app.js.
 $('#inboxPeople')?.addEventListener('click',e=>{const b=e.target.closest('.inboxPerson');if(!b)return;$$('.inboxPerson').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');if(b.dataset.matchid){activeMatch=b.dataset.matchid;shell?.classList.add('chat-open');document.body.classList.add('inbox-mode');if(typeof window.loadChats==='function')window.loadChats();return;}if(b.dataset.demoChat){showDemoChat(b.dataset.demoChat);return;}showDemoChat('amara')});
 $('#chatSafetyDismiss')?.addEventListener('click',()=>$('.chatSafetyNote')?.remove());
 $('#voiceCallBtn')?.addEventListener('click',()=>{const giftKey='lovoraGiftSentPreview:'+currentMemberName();if(!localStorage.getItem(giftKey)){info('Send a gift to unlock calls','LOVORA requires you to send a gift before starting a voice call with this match. Choose Send a gift first. Calls still require the secure calling provider before launch.');return;}info('Voice calls','Gift requirement satisfied in preview. Real voice calling will activate after a secure calling provider and permissions are configured.');});
 $('#videoCallBtn')?.addEventListener('click',()=>window.info?info('Video call','Video calling will be enabled after a secure WebRTC/calling provider is configured. This preview does not turn on your camera.'):alert('Video calling is not connected yet.'));
 $('#chatMoreBtn')?.addEventListener('click',()=>window.info?info('Conversation options','Choose Safety & rules to report or block a member. Never send money or share login codes.'):alert('Use Safety & rules to report or block a member.'));
 $('#chatAttach')?.addEventListener('click',()=>window.info?info('Photo sharing','Photo sharing needs secure Supabase Storage upload rules and image moderation. The attachment control is a preview until that is configured.'):alert('Photo sharing needs secure upload setup.'));
 $('#voiceNoteBtn')?.addEventListener('click',()=>window.info?info('Voice notes','Voice notes need microphone permission, secure audio storage and moderation controls. This button is a preview and has not recorded anything.'):alert('Voice notes are not connected yet.'));
 $('#chatEmoji')?.addEventListener('click',()=>{const i=$('#messageInput');i.value+=(i.value?' ':'')+'😊';i.focus()});
 $$('[data-chatquick]').forEach(b=>b.addEventListener('click',()=>{$('#messageInput').value=b.dataset.chatquick;$('#messageInput').focus()}));
 $('#sendGiftShortcut')?.addEventListener('click',()=>window.showView('wallet'));
 // Profile overflow menu slides open from the top; form fields remain editable below.
 const profileMenu=$('#profileDropdown'), profileTrigger=$('#profileMenuTrigger');
 profileTrigger?.addEventListener('click',()=>{const open=profileMenu.hidden;profileMenu.hidden=!open;profileTrigger.setAttribute('aria-expanded',String(open));});
 $$('[data-profile-focus]').forEach(b=>b.addEventListener('click',()=>{profileMenu.hidden=true;const field=$('#'+b.dataset.profileFocus);field?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>field?.focus(),250)}));
 // Conversation menu exposes profile, report and block actions for the currently selected member.
 function currentMemberName(){return ($('#chatPersonName')?.textContent||'Member').replace(/✓/g,'').trim();}
 function openMemberActions(){const name=currentMemberName();$('#memberActionName').textContent=name;$('#memberActionAvatar').textContent=(name[0]||'M').toUpperCase();$('#memberActionBio').textContent='Matched member · View their profile details and manage your safety options.';$('#memberActionDetails').innerHTML='<div><b>Connection</b><span>Matched on LOVORA</span></div><div><b>Interests</b><span>Open their profile to see interests, bio and photos.</span></div>';$('#memberActionModal').hidden=false;}
 $('#chatMoreBtn')?.addEventListener('click',openMemberActions);$('#closeMemberAction')?.addEventListener('click',()=>$('#memberActionModal').hidden=true);$('#memberActionModal')?.addEventListener('click',e=>{if(e.target.id==='memberActionModal')e.currentTarget.hidden=true});
 $('#viewMemberProfile')?.addEventListener('click',()=>{const n=currentMemberName();$('#memberActionModal').hidden=true;info('Profile: '+n,'The selected member’s full profile opens here when profile data is loaded from Supabase. The current demo chat does not contain a real member record.');});
 $('#reportMemberAction')?.addEventListener('click',()=>{const n=currentMemberName();$('#memberActionModal').hidden=true;$('#safetyTarget').value=n;window.showView('safety');toast('Choose a reason and submit your report.');});
 $('#blockMemberAction')?.addEventListener('click',()=>{const n=currentMemberName();$('#memberActionModal').hidden=true;$('#safetyTarget').value=n;window.showView('safety');toast('Confirm block in Safety & rules.');});
 // Search and unread filters in the inbox.
 $('#inboxSearch')?.addEventListener('input',e=>$$('.inboxPerson').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(e.target.value.toLowerCase())));
 $$('[data-inboxtab]').forEach(b=>b.addEventListener('click',()=>{$$('[data-inboxtab]').forEach(x=>x.classList.toggle('selected',x===b));if(b.dataset.inboxtab==='unread'){$$('.inboxPerson').forEach((x,i)=>x.hidden=i>1)}else $$('.inboxPerson').forEach(x=>x.hidden=false)}));
 $('#inboxFilter')?.addEventListener('click',()=>{$$('.inboxPerson').forEach((x,i)=>x.hidden=i>1);toast('Showing unread conversations in this preview.')});
 // Communities are an interest-based group directory, not a public posting feed.
 // Communities: preview cards remain visible until the additive Stage 2 migration is applied.
 const JOIN_KEY='lovoraJoinedCommunities_v1';let joined=JSON.parse(localStorage.getItem(JOIN_KEY)||'[]');
 function renderJoined(){ $$('.joinCommunity').forEach(b=>{const yes=joined.includes(b.dataset.join);b.classList.toggle('joined',yes);if(!b.dataset.communityId)b.innerHTML=yes?'✓ Joined <span>•</span>':'Join community <span>↗</span>';}); }
 function communityCard(c, memberCount=0, isJoined=false){
  const name=safe(c.name||'Community'), desc=safe(c.description||'A place to meet people who share your interests.'), category=safe((c.category||'general').toUpperCase());
  const id=safe(c.id), slug=safe(c.slug||c.name||'community'), premium=!!c.is_premium;
  return `<article class="communityCard ${premium?'premiumCommunity':''}" data-community="${slug.toLowerCase()}"><div class="communityArt techArt">◎</div><div class="communityCardBody"><span class="communityCategory">${category}${premium?' · ✦ GOLD':''}</span><h3>${name}</h3><p>${desc}</p><div class="communityStats"><span>◉ ${memberCount} members</span><span>● ${c.is_private?'Private':'Public'}</span></div>${premium?'<p class="premiumLockNote">✦ LOVORA Gold members only</p>':''}<button class="joinCommunity ${isJoined?'joined':''}" data-community-id="${id}" data-premium="${premium}" data-private="${!!c.is_private}" data-owner="${c.created_by===user?.id}" data-join="${name}">${isJoined?'✓ Joined':premium?'✦ Unlock with Gold':c.is_private?'Request to join':'Join community'} <span>↗</span></button>${c.is_private&&!isJoined?'<p class="fine">Private community · approval or invitation required</p>':''}${c.created_by===user?.id?`<div class="communityOwnerActions"><button type="button" class="outline communityManage" data-community-id="${id}" data-community-name="${name}">Manage requests</button><button type="button" class="outline communityInvite" data-community-id="${id}" data-community-name="${name}">Invite member</button></div>`:''}<button class="outline communityOpenChat" type="button" data-open-community="${id}" data-community-name="${name}" data-community-description="${desc}" ${isJoined?'':'disabled'}>${isJoined?'Open group chat':'Join to chat'}</button></div></article>`;
 }
 async function loadRealCommunities(){
  if(!supabaseClient||!user)return;
  const grid=$('#communityGrid'); if(!grid)return;
  const {data,error}=await supabaseClient.from('lovora_communities').select('id,slug,name,description,category,is_private,is_premium,rules,created_by,created_at').order('created_at',{ascending:false}).limit(60);
  if(error){console.info('LOVORA communities are not connected yet:',error.message);return;}
  if(!data?.length){wireCommunityChatButtons();return;}
  // Fetch only the signed-in user's memberships; never expose member UUIDs just to count a group.
  const [{data:mineRows},{data:counts}] = await Promise.all([
   supabaseClient.from('lovora_community_members').select('community_id').eq('user_id',user.id),
   supabaseClient.rpc('lovora_public_community_member_counts')
  ]);
  const mine=new Set((mineRows||[]).map(m=>m.community_id));
  const countMap=new Map((counts||[]).map(row=>[row.community_id,Number(row.member_count)||0]));
  grid.innerHTML=data.map(c=>communityCard(c,countMap.get(c.id)||0,mine.has(c.id))).join('');
  grid.querySelectorAll('.joinCommunity[data-community-id]').forEach(b=>b.addEventListener('click',async()=>{
   if(!user)return showAuth();
   const joinedNow=b.classList.contains('joined');
   if(!joinedNow && b.dataset.private==='true'){
    if(b.dataset.premium==='true'){
     const {data:profile}=await supabaseClient.from('profiles').select('premium_until').eq('id',user.id).maybeSingle();
     if(!profile?.premium_until || new Date(profile.premium_until)<=new Date()){toast('This private community is locked. Subscribe to LOVORA Gold first.');$('[data-view="gold"], [data-view="wallet"]')?.click();return;}
    }
    const {error}=await supabaseClient.rpc('lovora_request_community_join',{p_community_id:b.dataset.communityId});
    if(error){toast(error.message);return;}toast('Join request sent. The owner can approve it, or invite you directly.');return;
   }
   if(!joinedNow && b.dataset.premium==='true'){
    const {data:profile}=await supabaseClient.from('profiles').select('premium_until').eq('id',user.id).maybeSingle();
    if(!profile?.premium_until || new Date(profile.premium_until)<=new Date()){
     toast('This community is locked. Subscribe to LOVORA Gold to join.');
     const goldTab=$('[data-view="gold"], [data-view="wallet"]');if(goldTab)goldTab.click();
     return;
    }
   }
   const {error}=await supabaseClient.rpc(joinedNow?'lovora_leave_community':'lovora_join_community',{p_community_id:b.dataset.communityId});
   if(error){const msg=(error.message||'').toLowerCase();if(!joinedNow&&b.dataset.premium==='true'&&(msg.includes('premium')||msg.includes('gold')||msg.includes('subscription'))){toast('This community is locked. Subscribe to LOVORA Gold to join.');const goldTab=$('[data-view=\"gold\"], [data-view=\"wallet\"]');if(goldTab)goldTab.click();}else toast(error.message);return;}
   toast(joinedNow?'You left the community.':'Welcome to the community!');
   await loadRealCommunities();
  }));
  grid.querySelectorAll('.communityManage').forEach(b=>b.addEventListener('click',async()=>{
   const {data:rows,error}=await supabaseClient.from('lovora_community_join_requests').select('id,user_id,created_at').eq('community_id',b.dataset.communityId).eq('status','pending').order('created_at',{ascending:true});
   if(error){toast('Apply migration 06 to enable requests: '+error.message);return;}
   if(!rows?.length){toast('No pending join requests.');return;}
   for(const r of rows){const {data:profile}=await supabaseClient.from('profiles').select('display_name,username').eq('id',r.user_id).maybeSingle();const label=profile?.display_name||profile?.username||r.user_id;const approve=confirm(`${label} requested to join ${b.dataset.communityName}. Approve? Choose Cancel to reject.`);const {error:reviewError}=await supabaseClient.rpc('lovora_review_community_request',{p_request_id:r.id,p_approve:approve});if(reviewError)toast(reviewError.message);else toast(approve?'Request approved.':'Request rejected.');}
   await loadRealCommunities();
  }));
  grid.querySelectorAll('.communityInvite').forEach(b=>b.addEventListener('click',async()=>{const target=prompt("Enter the invited LOVORA user account UUID. They can find it in their account details.");if(!target)return;const {error}=await supabaseClient.rpc('lovora_invite_to_community',{p_community_id:b.dataset.communityId,p_invited_user_id:target.trim()});if(error)toast(error.message);else toast('Invitation sent.');}));
  wireCommunityChatButtons();
 }
 $('#myCommunityInvitesBtn')?.addEventListener('click',async()=>{
  if(!user||!supabaseClient){toast('Sign in to view invitations.');return;}
  const {data:invites,error}=await supabaseClient.from('lovora_community_invites').select('id,community_id,invited_by,created_at').eq('invited_user_id',user.id).eq('status','pending').order('created_at',{ascending:false});
  if(error){toast('Apply migration 06 to enable invitations: '+error.message);return;}if(!invites?.length){toast('You have no pending community invitations.');return;}
  for(const inv of invites){const {data:c}=await supabaseClient.from('lovora_communities').select('name,is_premium').eq('id',inv.community_id).maybeSingle();const accept=confirm(`Invitation to ${c?.name||'a community'}. Accept? Choose Cancel to decline.`);const {error:respondError}=await supabaseClient.rpc('lovora_respond_community_invite',{p_invite_id:inv.id,p_accept:accept});if(respondError)toast(respondError.message);else toast(accept?'Invitation accepted.':'Invitation declined.');}
  await loadRealCommunities();
 });
 $$('.joinCommunity').forEach(b=>b.addEventListener('click',async()=>{
  if(b.dataset.communityId)return;
  // Static starter cards must remain joinable even when Supabase is connected
  // but the Stage 2 community migration has not been installed yet. Only cards
  // carrying data-community-id use the real backend handler above.
  const n=b.dataset.join;if(joined.includes(n)){joined=joined.filter(x=>x!==n);toast('You left '+n+'.')}else{joined.push(n);toast('Joined '+n+' in preview mode. Sign in and connect the community database for synced membership.')}localStorage.setItem(JOIN_KEY,JSON.stringify(joined));renderJoined();
 }));
 $$('[data-communityfilter]').forEach(b=>b.addEventListener('click',()=>{$$('[data-communityfilter]').forEach(x=>x.classList.toggle('selected',x===b));$$('.communityCard').forEach((c,i)=>{c.hidden=b.dataset.communityfilter==='joined'?!c.querySelector('.joinCommunity')?.classList.contains('joined'):b.dataset.communityfilter==='new'?i<3:false})}));
 $('#communitySearch')?.addEventListener('input',e=>$$('.communityCard').forEach(c=>c.hidden=!c.textContent.toLowerCase().includes(e.target.value.toLowerCase())));
 const communitySheet=$('#communityCreateSheet'), communityBackdrop=$('#communitySheetBackdrop');
 function openCommunitySheet(){if(!user||!supabaseClient){toast('Sign in to create a community.');return;}communitySheet.hidden=false;communityBackdrop.hidden=false;requestAnimationFrame(()=>{communitySheet.classList.add('open');communityBackdrop.classList.add('show')});document.body.classList.add('sheet-open');}
 function closeCommunitySheet(){communitySheet.classList.remove('open');communityBackdrop.classList.remove('show');document.body.classList.remove('sheet-open');setTimeout(()=>{communitySheet.hidden=true;communityBackdrop.hidden=true},220)}
 $('#createCommunityBtn')?.addEventListener('click',openCommunitySheet);$('#closeCommunitySheet')?.addEventListener('click',closeCommunitySheet);communityBackdrop?.addEventListener('click',closeCommunitySheet);
 $('#communityCreateForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!user||!supabaseClient){toast('Sign in to create a community.');return;}const name=$('#newCommunityName').value.trim(),description=$('#newCommunityDescription').value.trim(),category=$('#newCommunityCategory').value,privacy=$('#newCommunityPrivacy').value,rules=$('#newCommunityRules').value.trim(),premium=$('#newCommunityPremium').checked;const slug=name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const btn=e.submitter;btn.disabled=true;btn.textContent='Creating…';try{const {error}=await supabaseClient.rpc('lovora_create_community',{p_name:name,p_slug:slug,p_description:description,p_category:category,p_is_private:privacy==='private',p_rules:rules,p_is_premium:premium});if(error){toast('Community setup needs the updated Supabase migration: '+error.message);return;}toast('Community created!');closeCommunitySheet();e.target.reset();await loadRealCommunities();}catch(err){toast('Could not create community: '+(err.message||'Please try again.'));}finally{btn.disabled=false;btn.textContent='Create community';}});
 // Real community group chat (requires the additive community SQL migrations).
 let activeCommunityId=null, communityChannel=null, communityRefreshTimer=null;
 const chatPanel=$('#communityChatPanel');
 function wireCommunityChatButtons(){
  $$('.communityOpenChat').forEach(b=>{if(b.dataset.wired)return;b.dataset.wired='1';b.addEventListener('click',()=>openCommunityChat(b.dataset.openCommunity,b.dataset.communityName,b.dataset.communityDescription));});
 }
 async function openCommunityChat(id,name,description){
  if(!user||!supabaseClient){toast('Sign in to use community chat.');return;}
  const card=$$('.communityCard').find(c=>c.querySelector(`[data-community-id="${CSS.escape(id)}"]`));
  const join=card?.querySelector('.joinCommunity');
  if(join&&!join.classList.contains('joined')){toast('Join this community first.');return;}
  activeCommunityId=id;$('#communityChatTitle').textContent=name||'Community chat';$('#communityChatDescription').textContent=description||'Chat with members of this community.';
  chatPanel.hidden=false;$('#communityChatMessages').innerHTML='<p class="muted">Loading conversation…</p>';
  if(communityChannel){try{await supabaseClient.removeChannel(communityChannel)}catch(_){}communityChannel=null;}
  await loadCommunityMessages();
  try{communityChannel=supabaseClient.channel('lovora-community-'+id).on('postgres_changes',{event:'*',schema:'public',table:'lovora_community_messages',filter:'community_id=eq.'+id},()=>loadCommunityMessages()).subscribe();}catch(e){console.info('Community realtime not enabled; polling will refresh messages.');}
  clearInterval(communityRefreshTimer);communityRefreshTimer=setInterval(()=>{if(activeCommunityId)loadCommunityMessages()},12000);
  chatPanel.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function loadCommunityMessages(){
  if(!activeCommunityId||!supabaseClient||!user)return;
  const box=$('#communityChatMessages');
  const {data,error}=await supabaseClient.from('lovora_community_messages').select('id,sender_id,content,created_at').eq('community_id',activeCommunityId).order('created_at',{ascending:true}).limit(150);
  if(error){box.innerHTML=`<p class="muted">Could not load messages. Make sure the community SQL migrations have been applied. ${safe(error.message)}</p>`;return;}
  box.innerHTML=(data||[]).map(m=>`<article class="communityMessage ${m.sender_id===user.id?'mine':''}"><p>${safe(m.content)}</p><small>${m.sender_id===user.id?'You':'Community member'} · ${relativeTime(m.created_at)}</small></article>`).join('')||'<p class="muted">No messages yet. Start a friendly conversation.</p>';
  box.scrollTop=box.scrollHeight;
 }
 $('#closeCommunityChat')?.addEventListener('click',async()=>{chatPanel.hidden=true;activeCommunityId=null;clearInterval(communityRefreshTimer);if(communityChannel&&supabaseClient){try{await supabaseClient.removeChannel(communityChannel)}catch(_){}communityChannel=null;}});
 $('#communityChatForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const input=$('#communityChatInput'),body=input.value.trim();if(!body||!activeCommunityId)return;
  const submit=e.submitter; if(submit)submit.disabled=true;
  const {error}=await supabaseClient.rpc('lovora_send_community_message',{p_community_id:activeCommunityId,p_content:body});
  if(submit)submit.disabled=false;
  if(error){toast(error.message);return;}input.value='';await loadCommunityMessages();
 });
 wireCommunityChatButtons();
 // Notifications are fetched from Supabase after Stage 2 migrations are applied; static sample alerts remain as a fallback.
 function relativeTime(value){const mins=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));if(mins<1)return 'Just now';if(mins<60)return `${mins} min ago`;const h=Math.floor(mins/60);if(h<24)return `${h} hr ago`;return `${Math.floor(h/24)} day(s) ago`;}
 async function loadRealNotifications(){
  if(!supabaseClient||!user)return;
  const list=$('#notificationList');if(!list)return;
  const {data,error}=await supabaseClient.from('lovora_notifications').select('id,kind,title,body,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
  if(error){console.info('LOVORA notifications are not connected yet:',error.message);return;}
  list.innerHTML=(data||[]).map(n=>`<article class="notificationItem ${n.read_at?'':'unread'}" data-notification-id="${safe(n.id)}"><span class="notificationIcon ${n.kind==='message'?'pinkIcon':n.kind==='match'?'blueIcon':'purpleIcon'}">${n.kind==='match'?'♡':n.kind==='message'?'✉':'♧'}</span><div><b>${safe(n.title)}</b><p>${safe(n.body||'')}</p><small>${relativeTime(n.created_at)}</small></div>${n.read_at?'':'<i class="unreadDot"></i>'}<button class="notificationReadBtn" type="button" aria-label="Mark notification as read">${n.read_at?'Read':'Mark read'}</button></article>`).join('')||'<p class="muted">You are all caught up. New activity will appear here.</p>';
  const count=(data||[]).filter(n=>!n.read_at).length;
  ['notificationBadge','topNotificationCount'].forEach(id=>{const el=$('#'+id);if(el){el.textContent=count>99?'99+':String(count);el.hidden=count===0;}});
  list.querySelectorAll('[data-notification-id]').forEach(row=>row.querySelector('.notificationReadBtn')?.addEventListener('click',async()=>{const {error}=await supabaseClient.rpc('lovora_mark_notification_read',{p_notification_id:row.dataset.notificationId});if(error){toast(error.message);return;}await loadRealNotifications();}));
 }
 $('#markAllRead')?.addEventListener('click',async()=>{
  if(supabaseClient&&user){const {data,error}=await supabaseClient.from('lovora_notifications').select('id').eq('user_id',user.id).is('read_at',null).limit(100);if(!error&&data){for(const n of data){const r=await supabaseClient.rpc('lovora_mark_notification_read',{p_notification_id:n.id});if(r.error){toast(r.error.message);return;}}await loadRealNotifications();toast('Notifications marked as read.');return;}}
  $$('.notificationItem').forEach(n=>n.classList.remove('unread'));$$('.unreadDot').forEach(n=>n.remove());$('#notificationBadge').textContent='0';if($('#topNotificationCount'))$('#topNotificationCount').textContent='0';$('.mobileUnread')?.remove();toast('Notifications marked as read on this device.');
 });
 // Expose refresh hooks for auth/view navigation.
 window.lovoraLoadCommunities=loadRealCommunities;window.lovoraLoadNotifications=loadRealNotifications;
 // Wallet animation and gift previews; do not fake a real payment or debit the live account.
 const COIN_KEY='lovoraCoins_v2';function syncWallet(){const v=localStorage.getItem(COIN_KEY)||'500';if($('#walletBalance'))$('#walletBalance').textContent=Number(v).toLocaleString();if($('#topCoinBalance'))$('#topCoinBalance').textContent=Number(v).toLocaleString();}
 $$('.giftCard').forEach(b=>b.addEventListener('click',()=>{const gift=b.dataset.gift,cost=Number(b.dataset.cost),recipient=currentMemberName();const ok=confirm('Send '+gift+' to '+recipient+' for '+cost.toLocaleString()+' coins? Preview only: no coins will be charged until the secure wallet is connected.');if(!ok)return;localStorage.setItem('lovoraGiftSentPreview:'+recipient,JSON.stringify({gift,cost,at:Date.now()}));toast(gift+' gift marked as sent in preview. Voice call requirement unlocked for '+recipient+'.');}));
 $('#getCoinsBtn')?.addEventListener('click',()=>window.showView('premium'));$('#topCoinBalance')?.addEventListener('click',()=>window.showView('wallet'));
 // Add visually realistic floating coin particles after successful local preview messages.
 document.addEventListener('click',e=>{if(e.target.closest('#getCoinsBtn'))return;});
 // The old code contains an unused feed implementation; no feed UI is rendered in this design.
 renderJoined();syncWallet();loadRealCommunities();loadRealNotifications();
 let notificationChannel=null; if(supabaseClient&&user){try{notificationChannel=supabaseClient.channel('lovora-notifications-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'lovora_notifications',filter:'user_id=eq.'+user.id},()=>loadRealNotifications()).subscribe();}catch(_){} setInterval(()=>{if(user)loadRealNotifications()},45000);}
})();
