<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="tiles-exterior" tilewidth="32" tileheight="32" tilecount="720" columns="16">
 <image source="tiles-exterior.png" width="512" height="1440"/>
 <tile id="0" type="grass_0">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="1" type="grass_1">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="2" type="grass_2">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="3" type="grass_3">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="4" type="dirt">
  <properties>
   <property name="surface" value="dirt"/>
  </properties>
 </tile>
 <tile id="5" type="street_cobble">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="6" type="road">
  <properties>
   <property name="surface" value="dirt"/>
  </properties>
 </tile>
 <tile id="7" type="road_lane_h">
  <properties>
   <property name="surface" value="dirt"/>
  </properties>
 </tile>
 <tile id="8" type="road_lane_v">
  <properties>
   <property name="surface" value="dirt"/>
  </properties>
 </tile>
 <tile id="9" type="crosswalk_h">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="10" type="crosswalk_v">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="11" type="sidewalk">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="12" type="sidewalk_curb_n">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="13" type="sidewalk_curb_s">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="14" type="sidewalk_curb_e">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="15" type="sidewalk_curb_w">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="16" type="sidewalk_curb_ne">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="17" type="sidewalk_curb_nw">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="18" type="sidewalk_curb_se">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="19" type="sidewalk_curb_sw">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="20" type="plaza_checker">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="21" type="plaza_pavers">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="22" type="plaza_pavers_cracked">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="23" type="plaza_terracotta">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="24" type="sand">
  <properties>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="25" type="dock_planks_h">
  <properties>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="26" type="dock_planks_v">
  <properties>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="27" type="rock_ground">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="28" type="cliff_top">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="29" type="cliff_face">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="30" type="cliff_face_alt">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="31" type="cliff_base">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="32" type="water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="water"/>
  </properties>
  <animation>
   <frame tileid="32" duration="250"/>
   <frame tileid="33" duration="250"/>
   <frame tileid="34" duration="250"/>
   <frame tileid="35" duration="250"/>
  </animation>
 </tile>
 <tile id="33" type="water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="water"/>
  </properties>
 </tile>
 <tile id="34" type="water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="water"/>
  </properties>
 </tile>
 <tile id="35" type="water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="water"/>
  </properties>
 </tile>
 <tile id="48" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="49" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="50" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="51" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="52" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="53" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="54" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="55" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="56" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="57" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="58" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="59" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="64" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="65" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="66" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="67" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="68" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="69" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="70" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="71" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="72" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="73" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="74" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="75" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="80" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="81" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="82" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="83" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="84" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="85" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="86" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="87" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="88" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="89" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="90" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="91" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="96" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="97" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="98" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="99" type="auto_grass_path">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="100" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="101" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="102" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="103" type="auto_grass_plaza">
  <properties>
   <property name="surface" value="paved"/>
  </properties>
 </tile>
 <tile id="104" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="105" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="106" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="107" type="auto_grass_sand">
  <properties>
   <property name="surface" value="grass"/>
  </properties>
 </tile>
 <tile id="112" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="112" duration="250"/>
   <frame tileid="116" duration="250"/>
   <frame tileid="120" duration="250"/>
   <frame tileid="124" duration="250"/>
  </animation>
 </tile>
 <tile id="113" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="113" duration="250"/>
   <frame tileid="117" duration="250"/>
   <frame tileid="121" duration="250"/>
   <frame tileid="125" duration="250"/>
  </animation>
 </tile>
 <tile id="114" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="114" duration="250"/>
   <frame tileid="118" duration="250"/>
   <frame tileid="122" duration="250"/>
   <frame tileid="126" duration="250"/>
  </animation>
 </tile>
 <tile id="115" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="115" duration="250"/>
   <frame tileid="119" duration="250"/>
   <frame tileid="123" duration="250"/>
   <frame tileid="127" duration="250"/>
  </animation>
 </tile>
 <tile id="116" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="117" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="118" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="119" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="120" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="121" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="122" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="123" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="124" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="125" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="126" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="127" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="128" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="128" duration="250"/>
   <frame tileid="132" duration="250"/>
   <frame tileid="136" duration="250"/>
   <frame tileid="140" duration="250"/>
  </animation>
 </tile>
 <tile id="129" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="129" duration="250"/>
   <frame tileid="133" duration="250"/>
   <frame tileid="137" duration="250"/>
   <frame tileid="141" duration="250"/>
  </animation>
 </tile>
 <tile id="130" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="130" duration="250"/>
   <frame tileid="134" duration="250"/>
   <frame tileid="138" duration="250"/>
   <frame tileid="142" duration="250"/>
  </animation>
 </tile>
 <tile id="131" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="131" duration="250"/>
   <frame tileid="135" duration="250"/>
   <frame tileid="139" duration="250"/>
   <frame tileid="143" duration="250"/>
  </animation>
 </tile>
 <tile id="132" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="133" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="134" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="135" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="136" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="137" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="138" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="139" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="140" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="141" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="142" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="143" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="144" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="144" duration="250"/>
   <frame tileid="148" duration="250"/>
   <frame tileid="152" duration="250"/>
   <frame tileid="156" duration="250"/>
  </animation>
 </tile>
 <tile id="145" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="145" duration="250"/>
   <frame tileid="149" duration="250"/>
   <frame tileid="153" duration="250"/>
   <frame tileid="157" duration="250"/>
  </animation>
 </tile>
 <tile id="146" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="146" duration="250"/>
   <frame tileid="150" duration="250"/>
   <frame tileid="154" duration="250"/>
   <frame tileid="158" duration="250"/>
  </animation>
 </tile>
 <tile id="147" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="147" duration="250"/>
   <frame tileid="151" duration="250"/>
   <frame tileid="155" duration="250"/>
   <frame tileid="159" duration="250"/>
  </animation>
 </tile>
 <tile id="148" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="149" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="150" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="151" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="152" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="153" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="154" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="155" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="156" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="157" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="158" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="159" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="160" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="160" duration="250"/>
   <frame tileid="164" duration="250"/>
   <frame tileid="168" duration="250"/>
   <frame tileid="172" duration="250"/>
  </animation>
 </tile>
 <tile id="161" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="161" duration="250"/>
   <frame tileid="165" duration="250"/>
   <frame tileid="169" duration="250"/>
   <frame tileid="173" duration="250"/>
  </animation>
 </tile>
 <tile id="162" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="162" duration="250"/>
   <frame tileid="166" duration="250"/>
   <frame tileid="170" duration="250"/>
   <frame tileid="174" duration="250"/>
  </animation>
 </tile>
 <tile id="163" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
  <animation>
   <frame tileid="163" duration="250"/>
   <frame tileid="167" duration="250"/>
   <frame tileid="171" duration="250"/>
   <frame tileid="175" duration="250"/>
  </animation>
 </tile>
 <tile id="164" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="165" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="166" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="167" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="168" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="169" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="170" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="171" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="172" type="auto_sand_water">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="173" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="174" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="175" type="auto_sand_water">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="surface" value="sand"/>
  </properties>
 </tile>
 <tile id="176" type="tree_round_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="177" type="tree_round_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="178" type="tree_round_trunk">
 </tile>
 <tile id="179" type="tree_round_trunk">
 </tile>
 <tile id="180" type="tree_round_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="181" type="tree_round_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="182" type="tree_pine_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="183" type="tree_pine_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="184" type="tree_pine_trunk">
 </tile>
 <tile id="185" type="tree_pine_trunk">
 </tile>
 <tile id="186" type="tree_pine_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="187" type="tree_pine_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="188" type="tree_autumn_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="189" type="tree_autumn_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="190" type="tree_autumn_trunk">
 </tile>
 <tile id="191" type="tree_autumn_trunk">
 </tile>
 <tile id="192" type="tree_round_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="193" type="tree_round_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="194" type="tree_round_trunk">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="195" type="tree_round_trunk">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="196" type="tree_autumn_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="197" type="tree_autumn_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="198" type="tree_pine_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="199" type="tree_pine_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="200" type="tree_pine_trunk">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="201" type="tree_pine_trunk">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="202" type="bush_plain">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="203" type="bush_berry">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="204" type="tree_autumn_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="205" type="tree_autumn_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="206" type="tree_autumn_trunk">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="207" type="tree_autumn_trunk">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="208" type="tree_round_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="209" type="tree_round_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="210" type="bush_flower">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="211" type="hedge_h_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="212" type="hedge_h_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="213" type="hedge_h_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="214" type="tree_pine_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="215" type="tree_pine_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="216" type="hedge_single">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="217" type="hedge_v_t">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="218" type="hedge_v_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="219" type="hedge_v_b">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="220" type="tree_autumn_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="221" type="tree_autumn_canopy">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="222" type="hedge_shadow_h_l">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="223" type="hedge_shadow_h_m">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="224" type="hedge_shadow_h_r">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="225" type="hedge_shadow_single">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="226" type="hedge_shadow_v_t">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="227" type="hedge_shadow_v_m">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="228" type="hedge_shadow_v_b">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="229" type="flower_box">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="230" type="flower_box">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="231" type="flower_pot">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="232" type="flower_patch">
 </tile>
 <tile id="233" type="leaf_litter">
 </tile>
 <tile id="234" type="shadow_round">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="235" type="shadow_wide">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="236" type="shadow_wide">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="237" type="shadow_pole">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="240" type="bench_front">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="241" type="bench_front">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="242" type="bench_back">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="243" type="bench_back">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="244" type="bench_side_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="245" type="bench_side_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="246" type="lamp_day">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="247" type="lamp_night">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="248" type="fountain_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="249" type="fountain_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="250" type="fountain_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="251" type="fence_h_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="252" type="fence_h_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="253" type="fence_h_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="254" type="fence_gate">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="255" type="fence_v_t">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="256" type="fence_v_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="257" type="fence_v_b">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="258" type="mailbox">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="259" type="barrel">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="260" type="bench_side_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="261" type="bench_side_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="262" type="lamp_day">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="263" type="lamp_night">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="264" type="crate">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="268" type="signpost">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="269" type="crate_stack">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="272" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="272" duration="200"/>
   <frame tileid="275" duration="200"/>
   <frame tileid="278" duration="200"/>
   <frame tileid="281" duration="200"/>
  </animation>
 </tile>
 <tile id="273" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="273" duration="200"/>
   <frame tileid="276" duration="200"/>
   <frame tileid="279" duration="200"/>
   <frame tileid="282" duration="200"/>
  </animation>
 </tile>
 <tile id="274" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="274" duration="200"/>
   <frame tileid="277" duration="200"/>
   <frame tileid="280" duration="200"/>
   <frame tileid="283" duration="200"/>
  </animation>
 </tile>
 <tile id="275" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="276" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="277" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="278" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="279" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="280" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="281" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="282" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="283" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="284" type="signpost">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="285" type="crate_stack">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="288" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="288" duration="200"/>
   <frame tileid="291" duration="200"/>
   <frame tileid="294" duration="200"/>
   <frame tileid="297" duration="200"/>
  </animation>
 </tile>
 <tile id="289" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="289" duration="200"/>
   <frame tileid="292" duration="200"/>
   <frame tileid="295" duration="200"/>
   <frame tileid="298" duration="200"/>
  </animation>
 </tile>
 <tile id="290" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="290" duration="200"/>
   <frame tileid="293" duration="200"/>
   <frame tileid="296" duration="200"/>
   <frame tileid="299" duration="200"/>
  </animation>
 </tile>
 <tile id="291" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="292" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="293" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="294" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="295" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="296" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="297" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="298" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="299" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="304" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="304" duration="200"/>
   <frame tileid="307" duration="200"/>
   <frame tileid="310" duration="200"/>
   <frame tileid="313" duration="200"/>
  </animation>
 </tile>
 <tile id="305" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="305" duration="200"/>
   <frame tileid="308" duration="200"/>
   <frame tileid="311" duration="200"/>
   <frame tileid="314" duration="200"/>
  </animation>
 </tile>
 <tile id="306" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="306" duration="200"/>
   <frame tileid="309" duration="200"/>
   <frame tileid="312" duration="200"/>
   <frame tileid="315" duration="200"/>
  </animation>
 </tile>
 <tile id="307" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="308" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="309" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="310" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="311" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="312" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="313" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="314" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="315" type="lamp_glow">
  <properties>
   <property name="fps" type="int" value="5"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="320" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="320" duration="167"/>
   <frame tileid="323" duration="167"/>
   <frame tileid="326" duration="167"/>
   <frame tileid="329" duration="167"/>
  </animation>
 </tile>
 <tile id="321" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="321" duration="167"/>
   <frame tileid="324" duration="167"/>
   <frame tileid="327" duration="167"/>
   <frame tileid="330" duration="167"/>
  </animation>
 </tile>
 <tile id="322" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="322" duration="167"/>
   <frame tileid="325" duration="167"/>
   <frame tileid="328" duration="167"/>
   <frame tileid="331" duration="167"/>
  </animation>
 </tile>
 <tile id="323" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="324" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="325" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="326" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="327" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="328" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="329" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="330" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="331" type="fountain">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="336" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
  </properties>
  <animation>
   <frame tileid="336" duration="167"/>
   <frame tileid="339" duration="167"/>
   <frame tileid="342" duration="167"/>
   <frame tileid="345" duration="167"/>
  </animation>
 </tile>
 <tile id="337" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
  </properties>
  <animation>
   <frame tileid="337" duration="167"/>
   <frame tileid="340" duration="167"/>
   <frame tileid="343" duration="167"/>
   <frame tileid="346" duration="167"/>
  </animation>
 </tile>
 <tile id="338" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
  </properties>
  <animation>
   <frame tileid="338" duration="167"/>
   <frame tileid="341" duration="167"/>
   <frame tileid="344" duration="167"/>
   <frame tileid="347" duration="167"/>
  </animation>
 </tile>
 <tile id="339" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="340" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="341" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="342" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="343" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="344" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="345" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="346" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="347" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="352" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
  </properties>
  <animation>
   <frame tileid="352" duration="167"/>
   <frame tileid="355" duration="167"/>
   <frame tileid="358" duration="167"/>
   <frame tileid="361" duration="167"/>
  </animation>
 </tile>
 <tile id="353" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
  </properties>
  <animation>
   <frame tileid="353" duration="167"/>
   <frame tileid="356" duration="167"/>
   <frame tileid="359" duration="167"/>
   <frame tileid="362" duration="167"/>
  </animation>
 </tile>
 <tile id="354" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="4"/>
  </properties>
  <animation>
   <frame tileid="354" duration="167"/>
   <frame tileid="357" duration="167"/>
   <frame tileid="360" duration="167"/>
   <frame tileid="363" duration="167"/>
  </animation>
 </tile>
 <tile id="355" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="356" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="357" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="358" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="359" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="360" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="361" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="362" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="363" type="fountain">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="4"/>
  </properties>
 </tile>
 <tile id="372" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="372" duration="500"/>
   <frame tileid="374" duration="500"/>
  </animation>
 </tile>
 <tile id="373" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="373" duration="500"/>
   <frame tileid="375" duration="500"/>
  </animation>
 </tile>
 <tile id="374" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="375" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="378" type="dock_edge_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="379" type="dock_edge_w">
  <properties>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="380" type="dock_edge_e">
  <properties>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="381" type="dock_bollard">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="382" type="dock_ladder">
  <properties>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="383" type="dock_rope_coil">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="surface" value="wood"/>
  </properties>
 </tile>
 <tile id="384" type="boat_row">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="384" duration="500"/>
   <frame tileid="386" duration="500"/>
  </animation>
 </tile>
 <tile id="385" type="boat_row">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="385" duration="500"/>
   <frame tileid="387" duration="500"/>
  </animation>
 </tile>
 <tile id="386" type="boat_row">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="387" type="boat_row">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="388" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="388" duration="500"/>
   <frame tileid="390" duration="500"/>
  </animation>
 </tile>
 <tile id="389" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="389" duration="500"/>
   <frame tileid="391" duration="500"/>
  </animation>
 </tile>
 <tile id="390" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="391" type="boat_fish">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="392" type="boat_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="393" type="boat_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="400" type="server_tower_green">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="green"/>
  </properties>
  <animation>
   <frame tileid="400" duration="500"/>
   <frame tileid="401" duration="500"/>
  </animation>
 </tile>
 <tile id="401" type="server_tower_green">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="green"/>
  </properties>
 </tile>
 <tile id="402" type="server_tower_green">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="green"/>
  </properties>
 </tile>
 <tile id="403" type="server_tower_green">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="state" value="green"/>
  </properties>
 </tile>
 <tile id="404" type="server_tower_yellow">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="yellow"/>
  </properties>
  <animation>
   <frame tileid="404" duration="500"/>
   <frame tileid="405" duration="500"/>
  </animation>
 </tile>
 <tile id="405" type="server_tower_yellow">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="yellow"/>
  </properties>
 </tile>
 <tile id="406" type="server_tower_yellow">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="yellow"/>
  </properties>
 </tile>
 <tile id="407" type="server_tower_yellow">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="state" value="yellow"/>
  </properties>
 </tile>
 <tile id="408" type="server_tower_red">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="red"/>
  </properties>
  <animation>
   <frame tileid="408" duration="500"/>
   <frame tileid="409" duration="500"/>
  </animation>
 </tile>
 <tile id="409" type="server_tower_red">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="red"/>
  </properties>
 </tile>
 <tile id="410" type="server_tower_red">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="red"/>
  </properties>
 </tile>
 <tile id="411" type="server_tower_red">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="state" value="red"/>
  </properties>
 </tile>
 <tile id="412" type="tower_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="413" type="tower_shadow">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="416" type="server_tower_green">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="green"/>
  </properties>
  <animation>
   <frame tileid="416" duration="500"/>
   <frame tileid="402" duration="500"/>
  </animation>
 </tile>
 <tile id="420" type="server_tower_yellow">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="yellow"/>
  </properties>
  <animation>
   <frame tileid="420" duration="500"/>
   <frame tileid="406" duration="500"/>
  </animation>
 </tile>
 <tile id="424" type="server_tower_red">
  <properties>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="state" value="red"/>
  </properties>
  <animation>
   <frame tileid="424" duration="500"/>
   <frame tileid="410" duration="500"/>
  </animation>
 </tile>
 <tile id="425" type="smoke">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="6"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="425" duration="167"/>
   <frame tileid="426" duration="167"/>
   <frame tileid="427" duration="167"/>
   <frame tileid="428" duration="167"/>
   <frame tileid="429" duration="167"/>
   <frame tileid="430" duration="167"/>
  </animation>
 </tile>
 <tile id="426" type="smoke">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="6"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="427" type="smoke">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="2"/>
   <property name="frames" type="int" value="6"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="428" type="smoke">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="3"/>
   <property name="frames" type="int" value="6"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="429" type="smoke">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="4"/>
   <property name="frames" type="int" value="6"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="430" type="smoke">
  <properties>
   <property name="fps" type="int" value="6"/>
   <property name="frame" type="int" value="5"/>
   <property name="frames" type="int" value="6"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="432" type="server_tower_green">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="state" value="green"/>
  </properties>
  <animation>
   <frame tileid="432" duration="500"/>
   <frame tileid="403" duration="500"/>
  </animation>
 </tile>
 <tile id="436" type="server_tower_yellow">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="state" value="yellow"/>
  </properties>
  <animation>
   <frame tileid="436" duration="500"/>
   <frame tileid="407" duration="500"/>
  </animation>
 </tile>
 <tile id="440" type="server_tower_red">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="state" value="red"/>
  </properties>
  <animation>
   <frame tileid="440" duration="500"/>
   <frame tileid="411" duration="500"/>
  </animation>
 </tile>
 <tile id="448" type="wall_cream_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="449" type="wall_cream_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="450" type="wall_cream_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="451" type="wall_cream_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="452" type="wall_brick_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="453" type="wall_brick_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="454" type="wall_brick_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="455" type="wall_brick_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="456" type="wall_blue_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="457" type="wall_blue_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="458" type="wall_blue_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="459" type="wall_blue_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="460" type="wall_pink_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="461" type="wall_pink_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="462" type="wall_pink_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="463" type="wall_pink_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="464" type="wall_cream_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="465" type="wall_cream_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="466" type="wall_cream_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="467" type="wall_cream_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="468" type="wall_brick_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="469" type="wall_brick_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="470" type="wall_brick_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="471" type="wall_brick_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="472" type="wall_blue_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="473" type="wall_blue_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="474" type="wall_blue_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="475" type="wall_blue_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="476" type="wall_pink_l">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="477" type="wall_pink_m">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="478" type="wall_pink_r">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="479" type="wall_pink_s">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="480" type="roof_terra_top_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="481" type="roof_terra_top_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="482" type="roof_terra_top_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="483" type="roof_terra_top_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="484" type="roof_terra_eave_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="485" type="roof_terra_eave_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="486" type="roof_terra_eave_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="487" type="roof_terra_eave_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="488" type="roof_slate_top_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="489" type="roof_slate_top_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="490" type="roof_slate_top_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="491" type="roof_slate_top_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="492" type="roof_slate_eave_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="493" type="roof_slate_eave_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="494" type="roof_slate_eave_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="495" type="roof_slate_eave_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="496" type="roof_green_top_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="497" type="roof_green_top_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="498" type="roof_green_top_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="499" type="roof_green_top_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="500" type="roof_green_eave_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="501" type="roof_green_eave_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="502" type="roof_green_eave_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="503" type="roof_green_eave_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="504" type="roof_brown_top_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="505" type="roof_brown_top_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="506" type="roof_brown_top_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="507" type="roof_brown_top_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="508" type="roof_brown_eave_l">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="509" type="roof_brown_eave_m">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="510" type="roof_brown_eave_r">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="511" type="roof_brown_eave_s">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="512" type="window_arched">
 </tile>
 <tile id="513" type="window_square">
 </tile>
 <tile id="514" type="window_shop">
 </tile>
 <tile id="515" type="window_pair">
 </tile>
 <tile id="516" type="door_arched">
 </tile>
 <tile id="517" type="door_glass">
 </tile>
 <tile id="518" type="door_panel">
 </tile>
 <tile id="519" type="awning_red_l">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="520" type="awning_red_m">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="521" type="awning_red_r">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="522" type="awning_red_s">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="523" type="awning_green_l">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="524" type="awning_green_m">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="525" type="awning_green_r">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="526" type="awning_green_s">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="527" type="awning_blue_l">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="528" type="window_arched">
 </tile>
 <tile id="529" type="window_square">
 </tile>
 <tile id="530" type="window_shop">
 </tile>
 <tile id="531" type="window_pair">
 </tile>
 <tile id="532" type="door_arched">
  <properties>
   <property name="block" type="bool" value="false"/>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="533" type="door_glass">
  <properties>
   <property name="block" type="bool" value="false"/>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="534" type="door_panel">
  <properties>
   <property name="block" type="bool" value="false"/>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="535" type="awning_blue_m">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="536" type="awning_blue_r">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="537" type="awning_blue_s">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="538" type="awning_yellow_l">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="539" type="awning_yellow_m">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="540" type="awning_yellow_r">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="541" type="awning_yellow_s">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="542" type="shadow_awning_l">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="543" type="shadow_awning_m">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="544" type="shadow_awning_r">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="545" type="shadow_awning_s">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="546" type="shadow_eave">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="547" type="shadow_ground_m">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="548" type="shadow_ground_end">
  <properties>
   <property name="overlay" value="shadow"/>
  </properties>
 </tile>
 <tile id="549" type="sign_cup">
 </tile>
 <tile id="550" type="sign_bread">
 </tile>
 <tile id="551" type="sign_flower">
 </tile>
 <tile id="552" type="sign_gear">
 </tile>
 <tile id="553" type="chimney">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="554" type="dormer">
  <properties>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="555" type="wall_lamp_day">
 </tile>
 <tile id="556" type="wall_lamp_night">
 </tile>
 <tile id="557" type="wall_lamp_glow">
  <properties>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="560" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="561" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="562" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="563" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="564" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="565" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="566" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="567" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="569" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="570" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="573" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="573" duration="500"/>
   <frame tileid="575" duration="500"/>
  </animation>
 </tile>
 <tile id="575" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="576" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="577" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="578" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="579" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="580" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="581" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="582" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="583" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="584" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="585" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="586" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="587" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="588" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="589" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="589" duration="500"/>
   <frame tileid="591" duration="500"/>
  </animation>
 </tile>
 <tile id="591" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="592" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="593" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="594" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="595" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="596" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="597" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="598" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="599" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="600" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="601" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="602" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="603" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="604" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="605" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="606" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="607" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
  </properties>
 </tile>
 <tile id="608" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="609" type="bank">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="610" type="bank">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="611" type="bank">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="612" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="613" type="library">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="614" type="library">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="615" type="library">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="616" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="617" type="studio">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="618" type="studio">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="619" type="studio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="620" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="621" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="fps" type="int" value="2"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
  </properties>
  <animation>
   <frame tileid="621" duration="500"/>
   <frame tileid="607" duration="500"/>
  </animation>
 </tile>
 <tile id="622" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="624" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="625" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="626" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="627" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="628" type="siren">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="628" duration="250"/>
   <frame tileid="630" duration="250"/>
  </animation>
 </tile>
 <tile id="629" type="siren">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
  <animation>
   <frame tileid="629" duration="250"/>
   <frame tileid="631" duration="250"/>
  </animation>
 </tile>
 <tile id="630" type="siren">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="631" type="siren">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="632" type="siren_glow">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="632" duration="250"/>
   <frame tileid="634" duration="250"/>
  </animation>
 </tile>
 <tile id="633" type="siren_glow">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="0"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
  <animation>
   <frame tileid="633" duration="250"/>
   <frame tileid="635" duration="250"/>
  </animation>
 </tile>
 <tile id="634" type="siren_glow">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="635" type="siren_glow">
  <properties>
   <property name="fps" type="int" value="4"/>
   <property name="frame" type="int" value="1"/>
   <property name="frames" type="int" value="2"/>
   <property name="layer" value="above"/>
   <property name="overlay" value="glow"/>
  </properties>
 </tile>
 <tile id="636" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="637" type="radio">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="638" type="radio">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="640" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="641" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="642" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="643" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="645" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="646" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="647" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="656" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="657" type="security">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="658" type="security">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="659" type="security">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="661" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="662" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="663" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="676" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="677" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="678" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="679" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="680" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
   <property name="layer" value="above"/>
  </properties>
 </tile>
 <tile id="692" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="693" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="694" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="695" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="696" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="708" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="709" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="710" type="town_hall">
  <properties>
   <property name="door" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="711" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <tile id="712" type="town_hall">
  <properties>
   <property name="block" type="bool" value="true"/>
  </properties>
 </tile>
 <wangsets>
  <wangset name="grass-path" type="corner" tile="99">
   <wangcolor name="grass" color="#72c048" tile="-1" probability="1"/>
   <wangcolor name="path" color="#b0743f" tile="-1" probability="1"/>
   <wangtile tileid="48" wangid="0,1,0,1,0,1,0,1"/>
   <wangtile tileid="49" wangid="0,1,0,1,0,2,0,1"/>
   <wangtile tileid="50" wangid="0,1,0,2,0,1,0,1"/>
   <wangtile tileid="51" wangid="0,1,0,2,0,2,0,1"/>
   <wangtile tileid="64" wangid="0,2,0,1,0,1,0,1"/>
   <wangtile tileid="65" wangid="0,2,0,1,0,2,0,1"/>
   <wangtile tileid="66" wangid="0,2,0,2,0,1,0,1"/>
   <wangtile tileid="67" wangid="0,2,0,2,0,2,0,1"/>
   <wangtile tileid="80" wangid="0,1,0,1,0,1,0,2"/>
   <wangtile tileid="81" wangid="0,1,0,1,0,2,0,2"/>
   <wangtile tileid="82" wangid="0,1,0,2,0,1,0,2"/>
   <wangtile tileid="83" wangid="0,1,0,2,0,2,0,2"/>
   <wangtile tileid="96" wangid="0,2,0,1,0,1,0,2"/>
   <wangtile tileid="97" wangid="0,2,0,1,0,2,0,2"/>
   <wangtile tileid="98" wangid="0,2,0,2,0,1,0,2"/>
   <wangtile tileid="99" wangid="0,2,0,2,0,2,0,2"/>
  </wangset>
  <wangset name="grass-plaza" type="corner" tile="103">
   <wangcolor name="grass" color="#72c048" tile="-1" probability="1"/>
   <wangcolor name="plaza" color="#e3cba6" tile="-1" probability="1"/>
   <wangtile tileid="52" wangid="0,1,0,1,0,1,0,1"/>
   <wangtile tileid="53" wangid="0,1,0,1,0,2,0,1"/>
   <wangtile tileid="54" wangid="0,1,0,2,0,1,0,1"/>
   <wangtile tileid="55" wangid="0,1,0,2,0,2,0,1"/>
   <wangtile tileid="68" wangid="0,2,0,1,0,1,0,1"/>
   <wangtile tileid="69" wangid="0,2,0,1,0,2,0,1"/>
   <wangtile tileid="70" wangid="0,2,0,2,0,1,0,1"/>
   <wangtile tileid="71" wangid="0,2,0,2,0,2,0,1"/>
   <wangtile tileid="84" wangid="0,1,0,1,0,1,0,2"/>
   <wangtile tileid="85" wangid="0,1,0,1,0,2,0,2"/>
   <wangtile tileid="86" wangid="0,1,0,2,0,1,0,2"/>
   <wangtile tileid="87" wangid="0,1,0,2,0,2,0,2"/>
   <wangtile tileid="100" wangid="0,2,0,1,0,1,0,2"/>
   <wangtile tileid="101" wangid="0,2,0,1,0,2,0,2"/>
   <wangtile tileid="102" wangid="0,2,0,2,0,1,0,2"/>
   <wangtile tileid="103" wangid="0,2,0,2,0,2,0,2"/>
  </wangset>
  <wangset name="grass-sand" type="corner" tile="107">
   <wangcolor name="grass" color="#72c048" tile="-1" probability="1"/>
   <wangcolor name="sand" color="#f6e7cf" tile="-1" probability="1"/>
   <wangtile tileid="56" wangid="0,1,0,1,0,1,0,1"/>
   <wangtile tileid="57" wangid="0,1,0,1,0,2,0,1"/>
   <wangtile tileid="58" wangid="0,1,0,2,0,1,0,1"/>
   <wangtile tileid="59" wangid="0,1,0,2,0,2,0,1"/>
   <wangtile tileid="72" wangid="0,2,0,1,0,1,0,1"/>
   <wangtile tileid="73" wangid="0,2,0,1,0,2,0,1"/>
   <wangtile tileid="74" wangid="0,2,0,2,0,1,0,1"/>
   <wangtile tileid="75" wangid="0,2,0,2,0,2,0,1"/>
   <wangtile tileid="88" wangid="0,1,0,1,0,1,0,2"/>
   <wangtile tileid="89" wangid="0,1,0,1,0,2,0,2"/>
   <wangtile tileid="90" wangid="0,1,0,2,0,1,0,2"/>
   <wangtile tileid="91" wangid="0,1,0,2,0,2,0,2"/>
   <wangtile tileid="104" wangid="0,2,0,1,0,1,0,2"/>
   <wangtile tileid="105" wangid="0,2,0,1,0,2,0,2"/>
   <wangtile tileid="106" wangid="0,2,0,2,0,1,0,2"/>
   <wangtile tileid="107" wangid="0,2,0,2,0,2,0,2"/>
  </wangset>
  <wangset name="sand-water" type="corner" tile="163">
   <wangcolor name="sand" color="#e3cba6" tile="-1" probability="1"/>
   <wangcolor name="water" color="#3a78c8" tile="-1" probability="1"/>
   <wangtile tileid="112" wangid="0,1,0,1,0,1,0,1"/>
   <wangtile tileid="113" wangid="0,1,0,1,0,2,0,1"/>
   <wangtile tileid="114" wangid="0,1,0,2,0,1,0,1"/>
   <wangtile tileid="115" wangid="0,1,0,2,0,2,0,1"/>
   <wangtile tileid="128" wangid="0,2,0,1,0,1,0,1"/>
   <wangtile tileid="129" wangid="0,2,0,1,0,2,0,1"/>
   <wangtile tileid="130" wangid="0,2,0,2,0,1,0,1"/>
   <wangtile tileid="131" wangid="0,2,0,2,0,2,0,1"/>
   <wangtile tileid="144" wangid="0,1,0,1,0,1,0,2"/>
   <wangtile tileid="145" wangid="0,1,0,1,0,2,0,2"/>
   <wangtile tileid="146" wangid="0,1,0,2,0,1,0,2"/>
   <wangtile tileid="147" wangid="0,1,0,2,0,2,0,2"/>
   <wangtile tileid="160" wangid="0,2,0,1,0,1,0,2"/>
   <wangtile tileid="161" wangid="0,2,0,1,0,2,0,2"/>
   <wangtile tileid="162" wangid="0,2,0,2,0,1,0,2"/>
   <wangtile tileid="163" wangid="0,2,0,2,0,2,0,2"/>
  </wangset>
 </wangsets>
</tileset>
