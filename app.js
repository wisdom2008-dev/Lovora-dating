const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let supabaseClient=null,user=null,profiles=[],index=0,isSignup=false,activeMatch=null,chatChannel=null,selectedProfilePhoto=null;
function toast(s){const t=$("#toast");t.textContent=s;t.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove("show"),2800)}
function configured(){return window.LOVORA_CONFIG?.SUPABASE_URL?.startsWith("https://")&&window.LOVORA_CONFIG?.SUPABASE_ANON_KEY&&!window.LOVORA_CONFIG.SUPABASE_ANON_KEY.includes("PASTE_")}
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="discover")loadProfiles();if(id==="likes")loadLikes();if(id==="matches")loadMatches();if(id==="messages")loadChats();window.scrollTo({top:0,behavior:"smooth"})}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>window.showView(b.dataset.view)));
$("#filtersButton").onclick=()=>$("#filters").classList.toggle("show");
function setAuthMode(signup){isSignup=signup;$("#authTitle").textContent=signup?"Create your account":"Welcome back";$("#authSubmit").textContent=signup?"Create account":"Sign in";$("#authToggle").textContent=signup?"Already have an account? Sign in":"New here? Create an account";$("#password").autocomplete=signup?"new-password":"current-password";$("#authSetupNote").textContent=configured()?"Your account will be secured by Supabase.":"Connect Supabase in config.js to create or access your account."}
function showAuth(){setAuthMode(true);document.body.classList.add("auth-open");$("#authModal").classList.add("show")}
$("#authButton").onclick=()=>user?signOut():showAuth();$("#closeAuth").onclick=()=>{ $("#authModal").classList.remove("show");document.body.classList.remove("auth-open") };
$("#authToggle").onclick=()=>setAuthMode(!isSignup);
$("#googleAuth").onclick=async()=>{if(!supabaseClient)return toast("Set up Supabase first.");const {error}=await supabaseClient.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});if(error)toast(error.message)};
$("#authForm").onsubmit=async e=>{e.preventDefault();if(!supabaseClient){toast("Connect Supabase in config.js before creating or accessing an account.");return}const email=$("#email").value.trim(),password=$("#password").value;let r=isSignup?await supabaseClient.auth.signUp({email,password}):await supabaseClient.auth.signInWithPassword({email,password});if(r.error){toast(r.error.message);return}if(isSignup&&!r.data.session){toast("Check your email to confirm your account, then sign in.");return}user=r.data.user;$("#authModal").classList.remove("show");document.body.classList.remove("auth-open");await refreshUser();toast(isSignup?"Account created. Welcome to LOVORA!":"Welcome back!")};
async function signOut(){if(supabaseClient)await supabaseClient.auth.signOut();user=null;refreshUser();toast("You have signed out.")}
async function refreshUser(){if(!user){$("#userName").textContent="Guest";$("#userStatus").textContent="Not signed in";$("#authButton").textContent="Sign in";$("#activity").textContent="Sign in to view your likes and matches.";return}$("#authButton").textContent="Sign out";$("#userStatus").textContent="Member";const {data}=await supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle();$("#userName").textContent=data?.display_name||user.email.split("@")[0];if(data)fillProfile(data);await loadProfiles();if(typeof window.lovoraLoadCommunities==='function')await window.lovoraLoadCommunities();if(typeof window.lovoraLoadNotifications==='function')await window.lovoraLoadNotifications()}
function showPhotoPreview(url){const box=$("#photoPreview");if(!box)return;box.innerHTML=url?`<img src="${escapeHtml(url)}" alt="Selected profile photo preview">`:'<span>📸 Your photo preview</span>'}
$("#photoFile").onchange=e=>{const file=e.target.files?.[0];selectedProfilePhoto=null;if(!file){showPhotoPreview($("#photoUrl").value.trim());return}if(!["image/jpeg","image/png","image/webp"].includes(file.type)){e.target.value="";showPhotoPreview($("#photoUrl").value.trim());return toast("Choose a JPG, PNG, or WebP image.")}if(file.size>5*1024*1024){e.target.value="";showPhotoPreview($("#photoUrl").value.trim());return toast("Your photo must be 5 MB or smaller.")}selectedProfilePhoto=file;showPhotoPreview(URL.createObjectURL(file))};
$("#photoUrl").oninput=()=>{if(!selectedProfilePhoto)showPhotoPreview($("#photoUrl").value.trim())};
function fillProfile(p){$("#displayName").value=p.display_name||"";$("#age").value=p.age||"";$("#city").value=p.city||"";$("#bio").value=p.bio||"";$("#interests").value=(p.interests||[]).join(", ");$("#photoUrl").value=p.photo_url||"";showPhotoPreview(p.photo_url||"");$("#cityTop").textContent=p.city||"Your city"}
$("#profileForm").onsubmit=async e=>{e.preventDefault();if(!user)return showAuth();if(!supabaseClient)return toast("Connect Supabase before saving a profile.");const age=Number($("#age").value);if(age<18)return toast("LOVORA is for adults aged 18 and over.");let photoUrl=$("#photoUrl").value.trim()||null;if(selectedProfilePhoto){const ext=selectedProfilePhoto.type==="image/png"?"png":selectedProfilePhoto.type==="image/webp"?"webp":"jpg";const path=`${user.id}/${Date.now()}.${ext}`;const {error:uploadError}=await supabaseClient.storage.from("lovora-photos").upload(path,selectedProfilePhoto,{contentType:selectedProfilePhoto.type,upsert:true});if(uploadError)return toast("Photo upload failed: "+uploadError.message);const {data:urlData}=supabaseClient.storage.from("lovora-photos").getPublicUrl(path);photoUrl=urlData.publicUrl}const p={id:user.id,display_name:$("#displayName").value.trim(),age,city:$("#city").value.trim(),bio:$("#bio").value.trim(),interests:$("#interests").value.split(",").map(x=>x.trim()).filter(Boolean),photo_url:photoUrl,updated_at:new Date().toISOString()};const {error}=await supabaseClient.from("profiles").upsert(p);if(error)return toast("Profile save failed: "+error.message);selectedProfilePhoto=null;$("#photoFile").value="";fillProfile(p);$("#userName").textContent=p.display_name;toast("Profile and photo saved!");loadProfiles()};
async function loadProfiles(){if(!supabaseClient||!user){renderPerson(null);return}let q=supabaseClient.from("profiles").select("id,display_name,age,city,bio,interests,photo_url,created_at").neq("id",user.id).gte("age",Number($("#minAge").value||18)).lte("age",Number($("#maxAge").value||99)).limit(50);const city=$("#cityFilter").value.trim();if(city)q=q.ilike("city",`%${city}%`);const {data,error}=await q;if(error){renderPerson(null);return}const {data:seen}=await supabaseClient.from("likes").select("to_user").eq("from_user",user.id);const excluded=new Set((seen||[]).map(x=>x.to_user));profiles=(data||[]).filter(p=>!excluded.has(p.id));index=0;renderPerson(profiles[0]||null)}
$("#applyFilters").onclick=()=>{loadProfiles();$("#filters").classList.remove("show")};
function renderPerson(p){if(!p){$("#personName").textContent=user?"No profiles found yet":"Welcome to LOVORA";$("#personLocation").textContent=user?"Complete your profile and invite others to join.":"Sign in after configuring Supabase to discover members.";$("#personBio").textContent=user?"Try changing filters later. New profiles will appear as members join.":"A secure online dating experience starts with a real account.";$("#personPhoto").style.backgroundImage="";$("#personTags").innerHTML="";return}$("#personName").textContent=`${p.display_name||"LOVORA member"}, ${p.age}`;$("#personLocation").textContent=[p.city,p.city?"":"", "LOVORA member"].filter(Boolean).join(" · ");$("#personBio").textContent=p.bio||"Still writing their story.";$("#personTags").innerHTML=(p.interests||[]).slice(0,5).map(t=>`<span>${escapeHtml(t)}</span>`).join("");$("#personPhoto").style.backgroundImage=p.photo_url?`linear-gradient(#09091420,#09091490),url("${p.photo_url.replace(/["\\]/g,"")}")`:"";$("#personPhoto").innerHTML=p.photo_url?"":'<span class="badge">Photo not added</span>'}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function react(kind){if(!user)return showAuth();const p=profiles[index];if(!p)return toast("No profile to show. Try again later.");if(kind==="pass"){index++;renderPerson(profiles[index]||null);return}const {error}=await supabaseClient.from("likes").insert({from_user:user.id,to_user:p.id,kind});if(error)return toast(error.code==="23505"?"You've already liked this profile.":error.message);if(kind==="like"||kind==="super"){const {data:back}=await supabaseClient.from("likes").select("id").eq("from_user",p.id).eq("to_user",user.id).limit(1);if(back?.length){const pair=[user.id,p.id].sort();await supabaseClient.from("matches").upsert({user1:pair[0],user2:pair[1]},{onConflict:"user1,user2"});toast(`It's a match! You and ${p.display_name} liked each other.`)}else toast(kind==="super"?"Super Like sent!":"Like sent!")}index++;renderPerson(profiles[index]||null)}
$("#pass").onclick=()=>react("pass");$("#like").onclick=()=>react("like");$("#super").onclick=()=>react("super");
async function loadLikes(){if(!user)return $("#likesList").innerHTML='<p class="muted">Sign in to see your likes.</p>';const {data,error}=await supabaseClient.from("likes").select("from_user,profiles:from_user(id,display_name,age,city,photo_url)").eq("to_user",user.id);renderTiles("likesList",data?.map(x=>x.profiles).filter(Boolean)||[],error)}
async function loadMatches(){if(!user)return $("#matchesList").innerHTML='<p class="muted">Sign in to see your matches.</p>';const {data,error}=await supabaseClient.from("matches").select("*").or(`user1.eq.${user.id},user2.eq.${user.id}`);if(error)return renderTiles("matchesList",[],error);const ids=(data||[]).map(m=>m.user1===user.id?m.user2:m.user1);if(!ids.length)return renderTiles("matchesList",[]);const r=await supabaseClient.from("profiles").select("id,display_name,age,city,photo_url").in("id",ids);renderTiles("matchesList",r.data||[],r.error)}
function renderTiles(id,arr,error){const el=$("#"+id);if(error){el.innerHTML=`<p class="muted">${escapeHtml(error.message)}</p>`;return}if(!arr.length){el.innerHTML='<p class="muted">Nothing here yet. Keep discovering people.</p>';return}el.innerHTML=arr.map(p=>`<article class="tile">${p.photo_url?`<img src="${escapeHtml(p.photo_url)}" alt="">`:"<div class='tilePhoto'>♥</div>"}<div><b>${escapeHtml(p.display_name||"Member")}, ${p.age||""}</b><p class="muted">${escapeHtml(p.city||"")}</p><button class="primary" data-openchat="${p.id}">Message</button></div></article>`).join("");el.querySelectorAll("[data-openchat]").forEach(b=>b.onclick=async()=>{if(!user)return showAuth();const other=b.dataset.openchat;const {data,error}=await supabaseClient.from("matches").select("id").or(`and(user1.eq.${user.id},user2.eq.${other}),and(user1.eq.${other},user2.eq.${user.id})`).maybeSingle();if(error||!data)return toast("You can message this person after a mutual match.");activeMatch=data.id;window.activeMatchId=activeMatch;showView("messages");loadChats()})}
async function loadChats(){if(!user){$("#chatStatus").textContent="Sign in and match with another member to begin.";return}const {data:ms,error}=await supabaseClient.from("matches").select("*").or(`user1.eq.${user.id},user2.eq.${user.id}`);if(error){$("#chatStatus").textContent=error.message;return}const ids=(ms||[]).map(m=>m.user1===user.id?m.user2:m.user1);if(!ids.length){$("#chatStatus").textContent="Match with someone first to start a conversation.";return}if(!activeMatch||!(ms||[]).some(m=>m.id===activeMatch))activeMatch=ms[0].id;window.activeMatchId=activeMatch;const {data:msgs, error:me}=await supabaseClient.from("messages").select("*").eq("match_id",activeMatch).order("created_at").limit(100);if(me){$("#chatStatus").textContent=me.message;return}$("#chatStatus").textContent="Chatting with a match · Be respectful and never share financial details.";$("#chatList").innerHTML=(msgs||[]).map(m=>`<p class="bubble ${m.sender_id===user.id?"mine":""}">${escapeHtml(m.content ?? m.body ?? '')}</p>`).join("");if(chatChannel)supabaseClient.removeChannel(chatChannel);chatChannel=supabaseClient.channel("chat-"+activeMatch).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`match_id=eq.${activeMatch}`},()=>loadChats()).subscribe()}
$$(".subscribe").forEach(b=>b.onclick=()=>toast("Payment processing is not active yet. Configure a provider such as Paystack and verify payments server-side before launch."));
async function boot(){if(configured()){supabaseClient=window.supabase.createClient(window.LOVORA_CONFIG.SUPABASE_URL,window.LOVORA_CONFIG.SUPABASE_ANON_KEY);const {data}=await supabaseClient.auth.getSession();user=data.session?.user||null;await refreshUser();supabaseClient.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setTimeout(refreshUser,0)});if(!user)showAuth()}else{refreshUser();setTimeout(showAuth,250)}}
boot();
// Local preview mode lets the interface be explored before Supabase is configured.
const demoPeople=[
 {id:'demo-amara',display_name:'Amara',age:26,city:'Lagos',bio:'Creative soul who loves live music, good food, and conversations that go past midnight.',interests:['Live music','Foodie','Art','Travel'],photo_url:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85'},
 {id:'demo-daniel',display_name:'Daniel',age:29,city:'Abuja',bio:'Product designer by day, amateur chef by night. Looking for something genuine and kind.',interests:['Design','Cooking','Fitness','Books'],photo_url:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85'},
 {id:'demo-zara',display_name:'Zara',age:24,city:'Port Harcourt',bio:'Soft life, big dreams, spontaneous road trips, and a playlist for every mood.',interests:['Fashion','Beach days','Music','Coffee'],photo_url:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85'},
 {id:'demo-michael',display_name:'Michael',age:31,city:'Lagos',bio:'Calm, curious, and always learning. I value honesty, laughter, and showing up.',interests:['Tech','Hiking','Movies','Growth'],photo_url:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=85'},
 {id:'demo-ife',display_name:'Ife',age:27,city:'Ibadan',bio:'A book lover with a soft spot for old-school romance and trying new restaurants.',interests:['Books','Brunch','Writing','Dogs'],photo_url:'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85'}
];
let demoLikes=[],demoMatches=[],demoMessages=[],demoIndex=0;
function renderPerson(p){if(!p){$('#personName').textContent='That’s everyone for now';$('#personLocation').textContent='Try adjusting your filters or check back later.';$('#personBio').textContent='New people join all the time. Your next great conversation could be just around the corner.';$('#personPhoto').style.backgroundImage='radial-gradient(circle at 50% 35%,#4b2456,#191525)';$('#personPhoto').innerHTML='<span class="badge">♥ Your next chapter awaits</span>';$('#personTags').innerHTML='';return}$('#personName').textContent=`${p.display_name||'LOVORA member'}, ${p.age||''}`;$('#personLocation').textContent=[p.city,'LOVORA member'].filter(Boolean).join(' · ');$('#personBio').textContent=p.bio||'Still writing their story.';$('#personTags').innerHTML=(p.interests||[]).slice(0,5).map(t=>`<span>${escapeHtml(t)}</span>`).join('');$('#personPhoto').style.backgroundImage=p.photo_url?`linear-gradient(180deg,#09091405,#09091435),url("${String(p.photo_url).replace(/["\\]/g,'')}")`:'radial-gradient(circle at 50% 35%,#4b2456,#191525)';$('#personPhoto').innerHTML='<span class="badge">✦ Featured profile</span>'}
async function loadProfiles(){if(!supabaseClient||!user){const min=Number($('#minAge')?.value||18),max=Number($('#maxAge')?.value||99),city=($('#cityFilter')?.value||'').trim().toLowerCase();profiles=demoPeople.filter(p=>p.age>=min&&p.age<=max&&(!city||p.city.toLowerCase().includes(city)));if(!profiles.length){profiles=demoPeople.filter(p=>p.age>=min&&p.age<=max)}demoIndex=Math.min(demoIndex,Math.max(0,profiles.length-1));index=demoIndex;renderPerson(profiles[index]||null);if(!document.querySelector('.demoBanner')){$('#discover .intro').insertAdjacentHTML('afterend','<div class="demoBanner" id="demoBanner">✨ Preview mode · Explore sample profiles now. Connect Supabase later to make accounts and matches real.</div>')}$('#activity').textContent=`${demoLikes.length} likes sent · ${demoMatches.length} demo matches`;return}const {data,error}=await supabaseClient.from('profiles').select('id,display_name,age,city,bio,interests,photo_url,created_at').neq('id',user.id).gte('age',Number($('#minAge').value||18)).lte('age',Number($('#maxAge').value||99)).limit(50);if(error){renderPerson(null);return}const {data:seen}=await supabaseClient.from('likes').select('to_user').eq('from_user',user.id);const excluded=new Set((seen||[]).map(x=>x.to_user));profiles=(data||[]).filter(p=>!excluded.has(p.id));index=0;renderPerson(profiles[0]||null)}
async function react(kind){const p=profiles[index];if(!p)return toast('No profile available. Try changing filters.');if(!supabaseClient||!user){if(kind==='pass'){demoIndex=(demoIndex+1)%Math.max(1,profiles.length);index=demoIndex;renderPerson(profiles[index]||null);toast('Passed · Preview mode');return}if(!demoLikes.includes(p.id))demoLikes.push(p.id);if(kind==='super')toast(`★ Super Like preview sent to ${p.display_name}`);else toast(`♥ Like preview sent to ${p.display_name}`);if(['demo-zara','demo-ife'].includes(p.id)&&!demoMatches.includes(p.id)){demoMatches.push(p.id);toast(`✨ It's a demo match with ${p.display_name}!`)}demoIndex=(demoIndex+1)%Math.max(1,profiles.length);index=demoIndex;renderPerson(profiles[index]||null);$('#activity').textContent=`${demoLikes.length} likes sent · ${demoMatches.length} demo matches`;return}if(kind==='pass'){index++;renderPerson(profiles[index]||null);return}const {error}=await supabaseClient.from('likes').insert({from_user:user.id,to_user:p.id,kind});if(error)return toast(error.code==='23505'?'Already liked this profile.':error.message);const {data:back}=await supabaseClient.from('likes').select('id').eq('from_user',p.id).eq('to_user',user.id).limit(1);if(back?.length){const pair=[user.id,p.id].sort();await supabaseClient.from('matches').upsert({user1:pair[0],user2:pair[1]},{onConflict:'user1,user2'});toast(`It's a match! You and ${p.display_name} liked each other.`)}else toast(kind==='super'?'Super Like sent!':'Like sent!');index++;renderPerson(profiles[index]||null)}
async function loadLikes(){if(!supabaseClient||!user){renderTiles('likesList',demoPeople.filter(p=>demoLikes.includes(p.id)));return}const {data,error}=await supabaseClient.from('likes').select('from_user,profiles:from_user(id,display_name,age,city,photo_url)').eq('to_user',user.id);renderTiles('likesList',data?.map(x=>x.profiles).filter(Boolean)||[],error)}
async function loadMatches(){if(!supabaseClient||!user){renderTiles('matchesList',demoPeople.filter(p=>demoMatches.includes(p.id)));return}const {data,error}=await supabaseClient.from('matches').select('*').or(`user1.eq.${user.id},user2.eq.${user.id}`);if(error)return renderTiles('matchesList',[],error);const ids=(data||[]).map(m=>m.user1===user.id?m.user2:m.user1);if(!ids.length)return renderTiles('matchesList',[]);const r=await supabaseClient.from('profiles').select('id,display_name,age,city,photo_url').in('id',ids);renderTiles('matchesList',r.data||[],r.error)}
async function loadChats(){
 if(!supabaseClient||!user){$('#chatStatus').textContent='Sign in and match with another member to begin.';const who=activeMatch||demoMatches[0]||demoPeople[0].id;const previewPerson=demoPeople.find(p=>p.id===who);$('#chatPersonName').textContent=previewPerson?.display_name||'LOVORA member';$('#chatList').innerHTML=demoMessages.map(m=>`<div class="messageRow ${m.mine?'outgoing':'incoming'}"><p class="bubble ${m.mine?'mine':''}">${escapeHtml(m.content ?? m.body ?? '')}</p></div>`).join('')||'<div class="chatEmpty"><div class="chatEmptyIcon">♡</div><strong>Your next connection starts here</strong><p>Match with someone you like, then say hello.</p></div>';return}
 const {data:ms,error}=await supabaseClient.from('matches').select('*').or(`user1.eq.${user.id},user2.eq.${user.id}`);
 if(error){$('#chatStatus').textContent=error.message;return}
 if(!ms?.length){$('#chatPersonName').textContent='Your matches';$('#chatStatus').textContent='Match with someone first to start a conversation.';$('#chatList').innerHTML='<div class="chatEmpty"><div class="chatEmptyIcon">♡</div><strong>No conversations yet</strong><p>When you and another member like each other, your chat will appear here.</p></div>';return}
 // Build the real inbox list from the member's actual matches.
 const matchIds=ms.map(m=>m.user1===user.id?m.user2:m.user1);
 const {data:partners}=await supabaseClient.from('profiles').select('id,display_name,photo_url').in('id',matchIds);
 const peopleById=new Map((partners||[]).map(p=>[p.id,p]));
 const inbox=$('#inboxPeople');
 if(inbox){inbox.innerHTML=ms.map((m,i)=>{const oid=m.user1===user.id?m.user2:m.user1,p=peopleById.get(oid)||{};return `<button class="inboxPerson ${m.id===activeMatch?'selected':''}" data-matchid="${escapeHtml(m.id)}" data-otherid="${escapeHtml(oid)}"><span class="inboxAvatar">${p.photo_url?`<img src="${escapeHtml(p.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:escapeHtml((p.display_name||'L')[0])}</span><span class="inboxPersonText"><b>${escapeHtml(p.display_name||'LOVORA member')}</b><small>Open your conversation</small></span><span class="inboxMeta"><small>Chat</small></span></button>`}).join('');}
 if(!activeMatch||!ms.some(m=>m.id===activeMatch))activeMatch=ms[0].id;window.activeMatchId=activeMatch;
 const {data:msgs,error:me}=await supabaseClient.from('messages').select('*').eq('match_id',activeMatch).order('created_at').limit(100);
 if(me){$('#chatStatus').textContent=me.message;return}
 const current=ms.find(m=>m.id===activeMatch);const otherId=current?(current.user1===user.id?current.user2:current.user1):null;
 if(otherId){const {data:partner}=await supabaseClient.from('profiles').select('display_name,photo_url').eq('id',otherId).maybeSingle();$('#chatPersonName').textContent=partner?.display_name||'Your match';const avatar=$('#chatAvatar');if(avatar){avatar.innerHTML=partner?.photo_url?`<img src="${escapeHtml(partner.photo_url)}" alt="" loading="lazy">`:'♥';}}
 $('#chatStatus').textContent='Connected match · Be respectful and never share financial details.';
 $('#chatList').innerHTML=(msgs||[]).map(m=>{const mine=m.sender_id===user.id;const raw=String(m.content ?? m.body ?? '');const gift=raw.startsWith('[LOVORA_GIFT]');const display=gift?raw.replace(/^\[LOVORA_GIFT\]\s*/, ''):raw;const receipt=mine?(m.read_at?'<span class="messageReceipt seen">Seen</span>':'<span class="messageReceipt">Sent</span>'):'';return `<div class="messageRow ${mine?'outgoing':'incoming'} ${gift?'giftMessageRow':''}"><p class="bubble ${mine?'mine':''} ${gift?'giftBubble':''}">${escapeHtml(display)}</p>${receipt}</div>`}).join('')||'<div class="chatEmpty"><div class="chatEmptyIcon">♡</div><strong>Say hello</strong><p>Start with something friendly and genuine.</p></div>';
 const timeline=$('#chatList');if(timeline)timeline.scrollTop=timeline.scrollHeight;
 // Mark incoming messages as read through the guarded database function included in this ZIP.
 try{await supabaseClient.rpc('mark_lovora_messages_read',{p_match_id:activeMatch})}catch(_e){}
 if(chatChannel){await supabaseClient.removeChannel(chatChannel);chatChannel=null}
 chatChannel=supabaseClient.channel('chat-'+activeMatch)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`match_id=eq.${activeMatch}`},()=>{if(document.visibilityState==='visible')loadChats()})
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:`match_id=eq.${activeMatch}`},()=>{if(document.visibilityState==='visible')loadChats()})
  .subscribe();
}

$('#matchForm').onsubmit=e=>{e.preventDefault();const looking=$('#lookingFor').value,priority=$('#priority').value,date=$('#firstDate').value.trim(),non=$('#nonNegotiables').value.trim();const out=$('#matchResult');out.hidden=false;out.innerHTML=`<b>✧ Your connection blueprint</b><br>You're exploring: <b>${escapeHtml(looking)}</b>.<br>Your top compatibility signal is <b>${escapeHtml(priority.toLowerCase())}</b>. ${date?`Your ideal first date sounds like: “${escapeHtml(date)}”. `:''}${non?`Keep your non-negotiables in mind: ${escapeHtml(non)}. `:''}<br><br><span class="muted">Tip: ask open questions, notice how someone communicates, and look for consistency over time. This is a guided preview, not a live AI assessment.</span>`;toast('Your compatibility profile is ready.')};
$$('[data-prompt]').forEach(b=>b.onclick=()=>{showView('messages');$('#messageInput').value=b.dataset.prompt;$('#messageInput').focus();toast('Conversation starter added to the message box.')});
function info(title,body){$('#infoTitle').textContent=title;$('#infoBody').textContent=body;$('#infoModal').classList.add('show')}$('#closeInfo').onclick=$('#infoOk').onclick=()=>$('#infoModal').classList.remove('show');
$('#startCall').onclick=()=>{if(!$('#callConsent').checked)return toast('Please confirm the preview notice first.');info('Date room preview','This preview does not turn on your camera or microphone. Real calls need a WebRTC/calling provider, secure signaling, match-based permissions, consent controls, and reporting tools before launch.')};$('#callHelp').onclick=()=>info('Calling integration','To enable real voice/video dates, the app needs a calling provider or WebRTC implementation, authenticated signaling, permission prompts, call invitations, end-call controls, and a safety/report flow. No call is placed by this starter.');
$('#verifyButton').onclick=()=>{if(!supabaseClient||!user){$('#verifyStatus').textContent='Preview status: request simulated locally';return info('Verification preview','Your request is only a local demo. Real verification must use a trusted vendor and a secure review process. Do not upload identity documents into this prototype.')}$('#verifyStatus').textContent='Status: request flow requires a secure verification provider';toast('Verification provider setup is required.')};
function logSafety(action){const target=$('#safetyTarget').value.trim();if(!target)return toast('Enter a member name or profile ID first.');const reason=$('#reportReason').value;const logs=JSON.parse(localStorage.getItem('lovoraSafetyPreview')||'[]');logs.unshift({action,target,reason,at:new Date().toLocaleString()});localStorage.setItem('lovoraSafetyPreview',JSON.stringify(logs.slice(0,20)));$('#safetyLog').textContent=`Preview ${action.toLowerCase()} recorded for ${target}. This stays in this browser only; it has not been sent to moderators.`;toast(`${action} recorded in preview.`)}$('#reportButton').onclick=()=>logSafety('Report');$('#blockButton').onclick=()=>logSafety('Block');
// Restore any local preview state and show a useful starting point.
try{demoLikes=JSON.parse(localStorage.getItem('lovoraDemoLikes')||'[]');demoMatches=JSON.parse(localStorage.getItem('lovoraDemoMatches')||'[]');demoMessages=JSON.parse(localStorage.getItem('lovoraDemoMessages')||'[]')}catch{}
const oldReactStore=window.setInterval(()=>{localStorage.setItem('lovoraDemoLikes',JSON.stringify(demoLikes));localStorage.setItem('lovoraDemoMatches',JSON.stringify(demoMatches));localStorage.setItem('lovoraDemoMessages',JSON.stringify(demoMessages))},2000);
loadProfiles();

/* LOVORA community + coin UX preview. Production coin balances and moderation must be enforced server-side. */
(()=>{
 const COIN_KEY='lovoraCoins_v2', PLAN_KEY='lovoraPlan_v2', FEED_KEY='lovoraFeed_v2';
 let coins=localStorage.getItem(COIN_KEY)===null?500:Number(localStorage.getItem(COIN_KEY));
 let plan=localStorage.getItem(PLAN_KEY)||'free';
 const get=s=>document.querySelector(s);
 const saveCoins=()=>{localStorage.setItem(COIN_KEY,String(coins));if(get('#coinBalance'))get('#coinBalance').textContent=plan==='free'?coins.toLocaleString():'∞';if(get('#coinPlan'))get('#coinPlan').textContent=plan==='free'?'500 welcome coins · 1 coin per message':`LOVORA Plus ${plan} · unlimited messages`;};
 const words=['fuck','shit','bitch','bastard','idiot','moron','stupid'];
 function moderated(text){const t=text.toLowerCase();const rude=words.some(w=>new RegExp('(^|\\W)'+w+'($|\\W)','i').test(t));const sexual=/(send nudes|show me your nude|explicit photo|dick pic|naked photo)/i.test(text);return {rude,sexual};}
 saveCoins();
 if(get('#postText')){get('#postText').addEventListener('input',()=>get('#postCount').textContent=get('#postText').value.length);}
 function readFeed(){try{return JSON.parse(localStorage.getItem(FEED_KEY)||'[]')}catch{return []}}
 function renderFeed(){const feed=get('#communityFeed');if(!feed)return;const posts=readFeed();feed.innerHTML=posts.length?posts.map((p,i)=>`<article class="card communityPost"><div class="postHead"><span class="avatar">${escapeHtml((p.author||'L')[0].toUpperCase())}</span><div><b>${escapeHtml(p.author||'LOVORA member')}</b><small>${escapeHtml(p.when||'Just now')}</small></div></div><p class="postBody">${escapeHtml(p.text)}</p><div class="postActions"><button type="button" data-likepost="${i}">♡ ${p.likes||0} Like</button><span>${p.comments.length} comments</span></div><div class="commentList">${p.comments.map(c=>`<p><b>${escapeHtml(c.author)}:</b> ${escapeHtml(c.text)}</p>`).join('')}</div><form class="commentForm" data-commentform="${i}"><input maxlength="100" name="comment" placeholder="Add a respectful comment… (100 max)" required><button class="outline">Comment</button></form></article>`).join(''):'<div class="card muted">No posts yet. Be the first to share something kind.</div>';
 feed.querySelectorAll('[data-likepost]').forEach(b=>b.onclick=()=>{const arr=readFeed(),i=Number(b.dataset.likepost);arr[i].likes=(arr[i].likes||0)+1;localStorage.setItem(FEED_KEY,JSON.stringify(arr));renderFeed()});
 feed.querySelectorAll('[data-commentform]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const input=f.elements.comment,text=input.value.trim();if(!text)return;if(text.length>100)return toast('Comments cannot exceed 100 characters.');const m=moderated(text);if(m.rude){return info('Please keep it respectful','That comment may be offensive. Please remove insults and try again. Repeated abusive comments may lead to a warning or account suspension after review.')}if(m.sexual)return info('Comment not allowed','Sexually explicit content is not allowed in community comments.');const arr=readFeed(),i=Number(f.dataset.commentform);arr[i].comments.push({author:user?.email?.split('@')[0]||'You',text});localStorage.setItem(FEED_KEY,JSON.stringify(arr));renderFeed();toast('Comment added in this device preview.')});
 }
 renderFeed();
 if(get('#postForm'))get('#postForm').onsubmit=e=>{e.preventDefault();const text=get('#postText').value.trim();if(!text)return;const m=moderated(text);if(m.rude)return info('Please keep it respectful','This post may contain offensive language. Please edit it. Repeated harassment can lead to a warning or suspension after review.');if(m.sexual)return info('Post not allowed','Sexually explicit content is not allowed in the community.');const arr=readFeed();arr.unshift({author:user?.email?.split('@')[0]||'You',text,when:'Just now',likes:0,comments:[]});localStorage.setItem(FEED_KEY,JSON.stringify(arr));get('#postText').value='';get('#postCount').textContent='0';renderFeed();toast('Post published in this device preview.')};
 // Enforce coin cost and text-based safety warning in the current preview message form.
 if(get('#messageForm'))get('#messageForm').onsubmit=async e=>{e.preventDefault();const input=get('#messageInput'),body=input.value.trim();if(!body)return;const m=moderated(body);if(m.rude)return info('Respectful chat only','Please avoid insults or abusive language. Repeated abuse may result in warnings or account suspension after review.');if(m.sexual)return info('Message blocked','LOVORA does not allow requests for nude or explicit images. Sending explicit media can lead to warnings and suspension.');if(!supabaseClient||!user){if(plan==='free'&&coins<1)return info('You are out of coins','You have used your free message coins. Choose LOVORA Plus for unlimited messaging.');if(plan==='free'){coins--;saveCoins()}demoMessages.push({body,mine:true});input.value='';await loadChats();toast(plan==='free'?'Message preview sent · 1 coin used.':'Plus preview message sent.');return}if(!activeMatch)return toast('Match with someone first.');const {error}=await supabaseClient.rpc('lovora_send_paid_message',{p_match_id:activeMatch,p_body:body});if(error)return toast(error.message);input.value='';await loadChats();toast('Message sent.');};
 // Profile shortcut from the chat header.
 if(get('#chatProfileLink'))get('#chatProfileLink').onclick=()=>{if(!activeMatch)return info('Profile details','Open a match first, then you can view their profile details here.');if(!supabaseClient||!user){const p=demoPeople.find(x=>x.id===activeMatch)||demoPeople[0];return info(`${p.display_name}, ${p.age}`,`${p.city}\n\n${p.bio}\n\nInterests: ${p.interests.join(', ')}`)}supabaseClient.from('profiles').select('display_name,age,city,bio,interests').eq('id',activeMatch).maybeSingle().then(({data,error})=>{if(error||!data)return info('Profile unavailable','Could not load this member profile yet.');info(`${data.display_name||'LOVORA member'}, ${data.age||''}`,`${data.city||''}\n\n${data.bio||''}\n\nInterests: ${(data.interests||[]).join(', ')}`)})};
 // Coin animation is deliberately limited to the wallet; chat bubbles stay still.
 document.querySelectorAll('.subscribe').forEach(b=>b.addEventListener('click',()=>{info('LOVORA Plus',`You selected the ${b.dataset.plan} plan. Payment is not connected yet, so your account has not been charged and unlimited messaging has not been activated. We will connect a verified payment provider before launch.`)}));
 window.lovoraPreviewCoins={get balance(){return coins},set plan(v){plan=v;localStorage.setItem(PLAN_KEY,v);saveCoins()}};
})();

/* LOVORA CHAT FIX (2026-10-27)
   Consolidates inbox loading and message sending so the active conversation,
   partner details, history, and realtime updates stay in sync. */
let lovoraChatLoadVersion = 0;
let lovoraChatBusy = false;

async function lovoraFixedLoadChats() {
  const status = document.querySelector('#chatStatus');
  const list = document.querySelector('#chatList');
  const inbox = document.querySelector('#inboxPeople');
  const name = document.querySelector('#chatPersonName');
  const avatar = document.querySelector('#chatAvatar');
  if (!status || !list) return;

  const version = ++lovoraChatLoadVersion;
  const safeText = value => escapeHtml(value == null ? '' : String(value));

  if (!supabaseClient || !user) {
    status.textContent = 'Preview mode · Sample messages are stored on this device only.';
    const key = typeof activeMatch === 'string' ? activeMatch : (demoMatches[0] || 'demo-amara');
    const person = demoPeople.find(p => p.id === key) || demoPeople[0];
    if (name) name.textContent = person.display_name;
    if (avatar) { avatar.className = 'chatAvatar'; avatar.textContent = (person.display_name || 'L')[0]; }
    list.innerHTML = demoMessages.map(m => `<div class="messageRow ${m.mine ? 'outgoing' : 'incoming'}"><p class="bubble ${m.mine ? 'mine' : ''}">${safeText(m.content ?? m.body ?? '')}</p></div>`).join('') || '<div class="chatEmpty"><div class="chatEmptyIcon">♡</div><strong>Your next connection starts here</strong><p>Match with someone you like, then say hello.</p></div>';
    if (inbox) inbox.querySelectorAll('[data-matchid]').forEach(el => el.classList.remove('selected'));
    list.scrollTop = list.scrollHeight;
    return;
  }

  status.textContent = 'Loading your conversations…';
  const { data: matches, error: matchError } = await supabaseClient
    .from('matches').select('id,user1,user2,created_at')
    .or(`user1.eq.${user.id},user2.eq.${user.id}`)
    .order('created_at', { ascending: false });
  if (version !== lovoraChatLoadVersion) return;
  if (matchError) { status.textContent = `Could not load conversations: ${matchError.message}`; return; }

  if (!matches?.length) {
    activeMatch = null;
    if (inbox) inbox.innerHTML = '<p class="muted">Your matches will appear here.</p>';
    if (name) name.textContent = 'Your matches';
    if (avatar) { avatar.className = 'chatAvatar'; avatar.textContent = '♡'; }
    status.textContent = 'Match with someone first to start a conversation.';
    list.innerHTML = '<div class="chatEmpty"><div class="chatEmptyIcon">♡</div><strong>No conversations yet</strong><p>When you and another member like each other, your chat will appear here.</p></div>';
    if (chatChannel) { try { await supabaseClient.removeChannel(chatChannel); } catch (_) {} chatChannel = null; }
    return;
  }

  if (!activeMatch || !matches.some(m => m.id === activeMatch)) activeMatch = matches[0].id;
  const otherIds = [...new Set(matches.map(m => m.user1 === user.id ? m.user2 : m.user1))];
  const { data: people, error: peopleError } = await supabaseClient
    .from('profiles').select('id,display_name,photo_url,age,city,bio,interests').in('id', otherIds);
  if (version !== lovoraChatLoadVersion) return;
  if (peopleError) { status.textContent = `Could not load match profiles: ${peopleError.message}`; return; }
  const byId = new Map((people || []).map(p => [p.id, p]));

  if (inbox) {
    inbox.innerHTML = matches.map(m => {
      const otherId = m.user1 === user.id ? m.user2 : m.user1;
      const p = byId.get(otherId) || {};
      const photo = p.photo_url ? `<img src="${safeText(p.photo_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : safeText((p.display_name || 'L')[0]);
      return `<button type="button" class="inboxPerson ${m.id === activeMatch ? 'selected' : ''}" data-matchid="${safeText(m.id)}" data-otherid="${safeText(otherId)}"><span class="inboxAvatar">${photo}</span><span class="inboxPersonText"><b>${safeText(p.display_name || 'LOVORA member')}</b><small>Open conversation</small></span><span class="inboxMeta"><small>Chat</small></span></button>`;
    }).join('');
  }

  const match = matches.find(m => m.id === activeMatch);
  const otherId = match ? (match.user1 === user.id ? match.user2 : match.user1) : null;
  const partner = otherId ? byId.get(otherId) : null;
  if (name) name.textContent = partner?.display_name || 'Your match';
  if (avatar) {
    avatar.className = 'chatAvatar';
    avatar.innerHTML = partner?.photo_url ? `<img src="${safeText(partner.photo_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : safeText((partner?.display_name || 'L')[0]);
  }

  const { data: messages, error: messageError } = await supabaseClient
    .from('messages').select('*').eq('match_id', activeMatch)
    .order('created_at', { ascending: true }).limit(200);
  if (version !== lovoraChatLoadVersion) return;
  if (messageError) { status.textContent = `Could not load messages: ${messageError.message}`; return; }

  status.textContent = 'Connected match · Be respectful and never share financial details.';
  list.innerHTML = (messages || []).map(m => {
    const mine = m.sender_id === user.id;
    const body = m.content ?? m.body ?? '';
    const time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="messageRow ${mine ? 'outgoing' : 'incoming'}"><p class="bubble ${mine ? 'mine' : ''}">${safeText(body)}${time ? `<small>${safeText(time)}</small>` : ''}</p></div>`;
  }).join('') || '<div class="chatEmpty"><div class="chatEmptyIcon">♡</div><strong>Say hello</strong><p>Start with something friendly and genuine.</p></div>';
  list.scrollTop = list.scrollHeight;

  // Optional read-receipt function: do not break chat if the migration is not installed.
  try { await supabaseClient.rpc('mark_lovora_messages_read', { p_match_id: activeMatch }); } catch (_) {}

  if (chatChannel) { try { await supabaseClient.removeChannel(chatChannel); } catch (_) {} chatChannel = null; }
  const channelMatchId = activeMatch;
  chatChannel = supabaseClient.channel(`lovora-chat-${channelMatchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${channelMatchId}` }, payload => {
      if (document.visibilityState === 'visible' && activeMatch === channelMatchId && payload?.eventType !== 'DELETE') {
        // Debounce bursty realtime events to avoid overlapping history loads.
        clearTimeout(window.lovoraChatRefreshTimer);
        window.lovoraChatRefreshTimer = setTimeout(() => lovoraFixedLoadChats(), 180);
      }
    }).subscribe();
}

// Replace the older duplicate implementation with the single fixed loader.
loadChats = lovoraFixedLoadChats;
window.loadChats = lovoraFixedLoadChats;

// A single send handler prevents the preview handler from overriding real messaging.
if (document.querySelector('#messageForm')) {
  document.querySelector('#messageForm').onsubmit = async event => {
    event.preventDefault();
    const input = document.querySelector('#messageInput');
    const body = input?.value?.trim();
    if (!body) return;
    if (body.length > 2000) return toast('Messages must be 2,000 characters or fewer.');
    const rudeWords = ['fuck', 'shit', 'bitch', 'bastard', 'idiot', 'moron', 'stupid'];
    if (rudeWords.some(word => new RegExp(`(^|\\W)${word}($|\\W)`, 'i').test(body))) return info('Respectful chat only', 'Please avoid insults or abusive language.');
    if (/(send nudes|show me your nude|explicit photo|dick pic|naked photo)/i.test(body)) return info('Message blocked', 'Requests for nude or explicit images are not allowed.');

    if (!supabaseClient || !user) {
      if (typeof demoMessages === 'undefined') return toast('Preview chat is unavailable.');
      demoMessages.push({ body, mine: true });
      try { localStorage.setItem('lovoraDemoMessages', JSON.stringify(demoMessages)); } catch (_) {}
      input.value = '';
      await lovoraFixedLoadChats();
      toast('Preview message added on this device only.');
      return;
    }
    if (!activeMatch) return toast('Open a conversation with one of your matches first.');
    if (lovoraChatBusy) return;
    lovoraChatBusy = true;
    const sendButton = document.querySelector('#messageForm button[type="submit"], #messageForm .sendBubble');
    if (sendButton) sendButton.disabled = true;
    try {
      const { error } = await supabaseClient.rpc('lovora_send_paid_message', { p_match_id: activeMatch, p_body: body });
      if (error) { toast(`Message not sent: ${error.message}`); return; }
      input.value = '';
      await lovoraFixedLoadChats();
      toast('Message sent.');
    } catch (error) {
      toast(`Message not sent: ${error?.message || 'Please try again.'}`);
    } finally {
      lovoraChatBusy = false;
      if (sendButton) sendButton.disabled = false;
    }
  };
}
